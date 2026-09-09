import { useCallback, useEffect, useMemo, useReducer, useState } from "react"
import { showcaseAgent } from "../data/agentTemplates"
import { createCanvasTransition } from "../lib/agentOperations"
import { createDraftHistory, reduceDraftHistory } from "../lib/history"
import { loadStoredSnapshots, saveStoredDraft } from "../lib/draftPersistence"
import { createAgentCollection, createStoredAgent, ensureDefaultAgents, loadAgentCollection, saveAgentCollection, updateStoredAgent } from "../lib/agentCollection"
import { validateAgentConfig } from "../lib/validateAgent"
import type { AgentCollection, AgentConfig, AgentEdge, AgentEditorAction, AgentNode, ConnectionInteractionState, EdgeHandleLayout, NodeCreationInput, NodeCreationKind, TransitionReference } from "../model/type"
import type { GraphOperation } from "../model/patch"
import { defaultNodePosition } from "../lib/graphLayout"
import { humanizeIdentifier, toIdentifier } from "../lib/identifier"
import { applyGraphOperations } from "../lib/graphPatch"

export function useAgentGraph() {
  const storedCollection = useMemo(() => loadAgentCollection(), [])
  const initialCollection = useMemo<AgentCollection>(() => ensureDefaultAgents(storedCollection ?? createAgentCollection(showcaseAgent)), [storedCollection])
  const initialAgent = useMemo(() => initialCollection.agents.find((agent) => agent.id === initialCollection.activeAgentId) ?? initialCollection.agents[0], [initialCollection])
  const initialDraft = initialAgent.draft
  const [history, dispatch] = useReducer(reduceDraftHistory, initialDraft, createDraftHistory)
  const draft = history.present
  const [agents, setAgents] = useState(initialCollection.agents)
  const [activeAgentId, setActiveAgentId] = useState(initialCollection.activeAgentId)
  const [savedDraft, setSavedDraft] = useState(initialDraft)
  const [snapshots, setSnapshots] = useState(() => loadStoredSnapshots())
  const [selectedNodeName, setSelectedNodeName] = useState<string | undefined>(initialDraft.config.initial_node)
  const [selectedTransition, setSelectedTransition] = useState<TransitionReference>()
  const [connectionInteraction, setConnectionInteraction] = useState<ConnectionInteractionState>({ mode: "idle" })
  useEffect(() => {
    if (!storedCollection) saveAgentCollection(initialCollection)
  }, [initialCollection, storedCollection])
  const selectedNode = useMemo(
    () => (selectedNodeName ? draft.config.nodes.find((node) => node.name === selectedNodeName) : undefined),
    [draft.config.nodes, selectedNodeName],
  )
  useEffect(() => {
    const selectedNodeStillExists = selectedNodeName && draft.config.nodes.some((node) => node.name === selectedNodeName)
    if (selectedNodeName && !selectedNodeStillExists) {
      setSelectedNodeName(undefined)
      setSelectedTransition(undefined)
    }

    if (selectedTransition) {
      const sourceNode = draft.config.nodes.find((node) => node.name === selectedTransition.source)
      const transitionStillExists = sourceNode?.edges.some((edge) => edge.function === selectedTransition.functionName)
      if (!transitionStillExists) setSelectedTransition(undefined)
    }
  }, [draft.config, selectedNodeName, selectedTransition])
  const validationErrors = useMemo(() => validateAgentConfig(draft.config), [draft.config])
  const apply = useCallback((action: AgentEditorAction) => dispatch({ type: "apply", action }), [])
  const updateNode = useCallback((nodeName: string, patch: Partial<AgentNode>) => apply({ type: "update_node", nodeName, patch }), [apply])
  const updateAgent = useCallback((patch: Pick<AgentConfig, "persona">) => apply({ type: "update_agent", patch }), [apply])
  const createNode = useCallback((kind: NodeCreationKind, input: NodeCreationInput) => {
    const nodeId = toIdentifier(input.name)
    const node: AgentNode = {
      name: nodeId,
      id: nodeId,
      title: input.title ?? humanizeIdentifier(input.name),
      type: kind,
      task_messages: [{ role: "developer", content: (input.instruction ?? (kind === "transfer" ? `Hand off the caller. Reason: ${input.transfer?.reason ?? ""}. Context: ${input.transfer?.context ?? ""}` : "")).trim() }],
      role_message: kind === "transfer" ? null : input.roleMessage?.trim() || null,
      edges: [],
      end: kind === "end" || kind === "transfer",
      ...(kind === "tool" ? { tool: input.tool ?? { name: nodeId, description: "", confirmationRequired: false } } : {}),
      ...(kind === "transfer" ? { transfer: input.transfer ?? { reason: "", context: "" } } : {}),
    }
    const position = defaultNodePosition(draft.config.nodes.length)
    apply({ type: "add_node", node, position })
    setSelectedNodeName(node.name)
    setSelectedTransition(undefined)
  }, [apply, draft.config.nodes.length])
  const deleteNode = useCallback((nodeName: string) => {
    if (nodeName === draft.config.initial_node) return

    const remainingNodes = draft.config.nodes.filter((node) => node.name !== nodeName)
    if (remainingNodes.length === draft.config.nodes.length) return

    apply({ type: "delete_node", nodeName })

    if (nodeName === selectedNodeName) {
      setSelectedNodeName(undefined)
    }

    if (selectedTransition?.source === nodeName) setSelectedTransition(undefined)
  }, [apply, draft.config, selectedNodeName, selectedTransition])
  const updateEdge = useCallback((source: string, functionName: string, patch: Partial<AgentEdge>) => {
    apply({ type: "update_edge", source, functionName, patch })
    if (patch.function && selectedTransition?.source === source && selectedTransition.functionName === functionName) {
      setSelectedTransition({ source, functionName: patch.function })
    }
  }, [apply, selectedTransition])
  const deleteEdge = useCallback((source: string, functionName: string) => {
    apply({ type: "delete_edge", source, functionName })
    if (selectedTransition?.source === source && selectedTransition.functionName === functionName) setSelectedTransition(undefined)
  }, [apply, selectedTransition])
  const createTransition = useCallback((source: string, target: string, handles: EdgeHandleLayout) => {
    const sourceNode = draft.config.nodes.find((node) => node.name === source)
    const targetNode = draft.config.nodes.find((node) => node.name === target)
    const edge = createCanvasTransition(sourceNode, targetNode)
    if (!edge) return
    apply({ type: "add_edge", source, edge, handles })
    const transition = { source, functionName: edge.function }
    setSelectedNodeName(source)
    setSelectedTransition(transition)
    setConnectionInteraction({ mode: "idle" })
  }, [apply, draft.config.nodes])
  const selectTransition = useCallback((transition: TransitionReference) => {
    setSelectedNodeName(transition.source)
    setSelectedTransition(transition)
  }, [])
  const startConnection = useCallback(() => setConnectionInteraction({ mode: "creating" }), [])
  const cancelConnection = useCallback(() => setConnectionInteraction({ mode: "idle" }), [])
  const moveNode = useCallback((nodeName: string, position: { x: number; y: number }) => apply({ type: "move_node", nodeName, position }), [apply])
  const setInitialNode = useCallback((nodeName: string) => apply({ type: "set_initial_node", nodeName }), [apply])
  const persistCurrentAgent = useCallback((nextDraft: typeof draft, nextAgents = agents, nextActiveAgentId = activeAgentId) => {
    const nextAgent = { id: nextActiveAgentId, draft: nextDraft, updatedAt: new Date().toISOString() }
    const nextCollection = updateStoredAgent({ activeAgentId: nextActiveAgentId, agents: nextAgents }, nextAgent)
    setAgents(nextCollection.agents)
    saveAgentCollection(nextCollection)
    return nextCollection
  }, [activeAgentId, agents, draft])
  const createAgent = useCallback((config: AgentConfig) => {
    const nextAgent = createStoredAgent(config)
    const currentAgent = { id: activeAgentId, draft, updatedAt: new Date().toISOString() }
    const existingAgents = agents.map((agent) => agent.id === activeAgentId ? currentAgent : agent)
    const nextCollection = { activeAgentId: nextAgent.id, agents: [...existingAgents, nextAgent] }
    setAgents(nextCollection.agents)
    setActiveAgentId(nextAgent.id)
    saveAgentCollection(nextCollection)
    dispatch({ type: "replace", draft: nextAgent.draft })
    setSavedDraft(nextAgent.draft)
    setSnapshots([])
    setSelectedNodeName(nextAgent.draft.config.initial_node)
    setSelectedTransition(undefined)
  }, [activeAgentId, agents, draft])
  const deleteAgent = useCallback(() => {
    if (agents.length <= 1) return false
    const nextAgents = agents.filter((agent) => agent.id !== activeAgentId)
    const nextActiveAgent = nextAgents[0]
    if (!nextActiveAgent) return false
    const collection = { activeAgentId: nextActiveAgent.id, agents: nextAgents }
    setAgents(collection.agents)
    setActiveAgentId(nextActiveAgent.id)
    saveAgentCollection(collection)
    dispatch({ type: "replace", draft: nextActiveAgent.draft })
    setSavedDraft(nextActiveAgent.draft)
    setSnapshots([])
    setSelectedNodeName(nextActiveAgent.draft.config.initial_node)
    setSelectedTransition(undefined)
    return true
  }, [activeAgentId, agents])
  const selectAgent = useCallback((agentId: string) => {
    if (agentId === activeAgentId) return
    const target = agents.find((agent) => agent.id === agentId)
    if (!target) return
    const currentAgent = { id: activeAgentId, draft, updatedAt: new Date().toISOString() }
    const nextCollection = { activeAgentId: agentId, agents: agents.map((agent) => agent.id === activeAgentId ? currentAgent : agent) }
    setAgents(nextCollection.agents)
    setActiveAgentId(agentId)
    saveAgentCollection(nextCollection)
    dispatch({ type: "replace", draft: target.draft })
    setSavedDraft(target.draft)
    setSnapshots([])
    setSelectedNodeName(target.draft.config.initial_node)
    setSelectedTransition(undefined)
  }, [activeAgentId, agents])
  const saveDraft = useCallback(() => {
    const nextDraft = { ...draft, config: { ...draft.config, revision: draft.config.revision + 1 } }
    dispatch({ type: "replace", draft: nextDraft })
    saveStoredDraft(nextDraft)
    persistCurrentAgent(nextDraft)
    setSnapshots(loadStoredSnapshots())
    setSavedDraft(nextDraft)
  }, [draft, persistCurrentAgent])
  const commitSuggestedFix = useCallback((preview: typeof draft, expectedAgentId: string, expectedVersion: string) => {
    const currentVersion = `${draft.config.id}-v${draft.config.revision}`
    if (expectedAgentId !== activeAgentId || expectedVersion !== currentVersion) return [{ path: "suggested-fix", message: "The suggested fix is based on an older agent draft.", severity: "error" as const }]
    const nextDraft = { ...preview, config: { ...preview.config, id: draft.config.id, revision: draft.config.revision + 1 } }
    dispatch({ type: "replace", draft: nextDraft })
    saveStoredDraft(nextDraft)
    persistCurrentAgent(nextDraft)
    setSnapshots(loadStoredSnapshots())
    setSavedDraft(nextDraft)
    setSelectedNodeName(nextDraft.config.initial_node)
    setSelectedTransition(undefined)
    return []
  }, [activeAgentId, draft, persistCurrentAgent])
  const loadDraft = useCallback((nextDraft: typeof draft) => {
    dispatch({ type: "replace", draft: nextDraft })
    setSavedDraft(nextDraft)
    setSelectedNodeName(nextDraft.config.initial_node)
    setSelectedTransition(undefined)
  }, [])
  const restoreSnapshot = useCallback((snapshot: typeof draft) => {
    loadDraft(snapshot)
  }, [loadDraft])
  const applyCopilotOperations = useCallback((operations: GraphOperation[], acceptedIndices?: number[]) => {
    const preview = applyGraphOperations(draft, operations, acceptedIndices)
    if (preview.errors.some((error) => error.severity === "error")) return preview
    dispatch({ type: "replace", draft: { config: preview.document, layout: preview.layout, edgeHandles: preview.edgeHandles } })
    return preview
  }, [draft])

  return {
    agent: draft.config,
    agents,
    activeAgentId,
    draft,
    selectedNode,
    selectedNodeName,
    selectNode: setSelectedNodeName,
    updateNode,
    updateAgent,
    deleteNode,
    updateEdge,
    deleteEdge,
    moveNode,
    setInitialNode,
    createNode,
    createTransition,
    selectTransition,
    selectedTransition,
    connectionInteraction,
    startConnection,
    cancelConnection,
    createAgent,
    deleteAgent,
    selectAgent,
    saveDraft,
    commitSuggestedFix,
    loadDraft,
    applyCopilotOperations,
    snapshots,
    restoreSnapshot,
    undo: () => dispatch({ type: "undo" }),
    redo: () => dispatch({ type: "redo" }),
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    draftVersion: `${draft.config.id}-v${draft.config.revision}`,
    validationErrors,
    isDirty: JSON.stringify(draft) !== JSON.stringify(savedDraft),
  }
}
