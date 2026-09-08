import { useCallback, useEffect, useMemo, useReducer, useState } from "react"
import { exampleAgent } from "../data/exampleAgent"
import { createAgentDraft, createCanvasTransition } from "../lib/agentOperations"
import { createDraftHistory, reduceDraftHistory } from "../lib/history"
import { loadStoredDraft, saveStoredDraft } from "../lib/draftPersistence"
import { validateAgentConfig } from "../lib/validateAgent"
import type { AgentConfig, AgentEdge, AgentEditorAction, AgentNode, ConnectionInteractionState, NodeCreationInput, NodeCreationKind, TransitionReference } from "../model/type"
import { defaultNodePosition } from "../lib/graphLayout"
import { humanizeIdentifier, toIdentifier } from "../lib/identifier"

export function useAgentGraph() {
  const initialDraft = useMemo(() => loadStoredDraft() ?? createAgentDraft(exampleAgent), [])
  const [history, dispatch] = useReducer(reduceDraftHistory, initialDraft, createDraftHistory)
  const draft = history.present
  const [savedDraft, setSavedDraft] = useState(initialDraft)
  const [selectedNodeName, setSelectedNodeName] = useState<string | undefined>(initialDraft.config.initial_node)
  const [selectedTransition, setSelectedTransition] = useState<TransitionReference>()
  const [connectionInteraction, setConnectionInteraction] = useState<ConnectionInteractionState>({ mode: "idle" })
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
      task_messages: [{ role: "developer", content: input.instruction.trim() }],
      role_message: input.roleMessage?.trim() || null,
      edges: [],
      end: kind === "end",
      ...(kind === "tool" ? { tool: input.tool ?? { name: nodeId, description: "", confirmationRequired: false } } : {}),
      ...(kind === "branch" ? { branch: input.branch ?? { expression: "" } } : {}),
      ...(kind === "transfer" ? { transfer: input.transfer ?? { reason: "", context: "" } } : {}),
    }
    const position = defaultNodePosition(draft.config.nodes.length)
    apply({ type: "add_node", node, position })
    setSelectedNodeName(node.name)
    setSelectedTransition(undefined)
  }, [apply, draft.config.nodes.length])
  const updateNodeAndSelection = useCallback((nodeName: string, patch: Partial<AgentNode>) => {
    updateNode(nodeName, patch)
  }, [updateNode])
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
  const createTransition = useCallback((source: string, target: string) => {
    const sourceNode = draft.config.nodes.find((node) => node.name === source)
    const targetNode = draft.config.nodes.find((node) => node.name === target)
    const edge = createCanvasTransition(sourceNode, targetNode)
    if (!edge) return
    apply({ type: "add_edge", source, edge })
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
  const resetDraft = useCallback(() => {
    const factoryDraft = createAgentDraft(exampleAgent)
    dispatch({ type: "replace", draft: factoryDraft })
    setSavedDraft(factoryDraft)
    setSelectedNodeName(factoryDraft.config.initial_node)
    setSelectedTransition(undefined)
  }, [])
  const saveDraft = useCallback(() => {
    const nextDraft = { ...draft, config: { ...draft.config, revision: draft.config.revision + 1 } }
    dispatch({ type: "replace", draft: nextDraft })
    saveStoredDraft(nextDraft)
    setSavedDraft(nextDraft)
  }, [draft])
  const loadDraft = useCallback((nextDraft: typeof draft) => {
    dispatch({ type: "replace", draft: nextDraft })
    setSavedDraft(nextDraft)
    setSelectedNodeName(nextDraft.config.initial_node)
    setSelectedTransition(undefined)
  }, [])

  return {
    agent: draft.config,
    draft,
    selectedNode,
    selectedNodeName,
    selectNode: setSelectedNodeName,
    updateNode: updateNodeAndSelection,
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
    resetDraft,
    saveDraft,
    loadDraft,
    undo: () => dispatch({ type: "undo" }),
    redo: () => dispatch({ type: "redo" }),
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    draftVersion: `${draft.config.id}-v${draft.config.revision}`,
    validationErrors,
    isDirty: JSON.stringify(draft) !== JSON.stringify(savedDraft),
  }
}
