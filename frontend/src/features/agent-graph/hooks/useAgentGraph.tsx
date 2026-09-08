import { useCallback, useMemo, useReducer, useState } from "react"
import { exampleAgent } from "../data/exampleAgent"
import { applyAgentAction, createAgentDraft } from "../lib/agentOperations"
import { validateAgentConfig } from "../lib/validateAgent"
import type { AgentEdge, AgentEditorAction, AgentNode } from "../model/type"

export function useAgentGraph() {
  const [draft, dispatch] = useReducer(applyAgentAction, exampleAgent, createAgentDraft)
  const [selectedNodeName, setSelectedNodeName] = useState(exampleAgent.initial_node)
  const selectedNode = useMemo(
    () => draft.config.nodes.find((node) => node.name === selectedNodeName) ?? draft.config.nodes[0],
    [draft.config.nodes, selectedNodeName],
  )
  const validationErrors = useMemo(() => validateAgentConfig(draft.config), [draft.config])
  const initialDraft = useMemo(() => createAgentDraft(exampleAgent), [])
  const apply = useCallback((action: AgentEditorAction) => dispatch(action), [])
  const updateNode = useCallback((nodeName: string, patch: Partial<AgentNode>) => apply({ type: "update_node", nodeName, patch }), [apply])
  const addNode = useCallback(() => {
    const nodeNames = new Set(draft.config.nodes.map((node) => node.name))
    let index = draft.config.nodes.length + 1
    let nodeName = `new_step_${index}`
    while (nodeNames.has(nodeName)) {
      index += 1
      nodeName = `new_step_${index}`
    }
    const node: AgentNode = {
      name: nodeName,
      task_messages: [{ role: "developer", content: "" }],
      edges: [],
      end: false,
    }
    const position = { x: 230, y: draft.config.nodes.length * 195 }
    apply({ type: "add_node", node, position })
    setSelectedNodeName(node.name)
  }, [apply, draft.config.nodes])
  const updateNodeAndSelection = useCallback((nodeName: string, patch: Partial<AgentNode>) => {
    updateNode(nodeName, patch)
    if (patch.name && patch.name !== nodeName && patch.name.trim() && !draft.config.nodes.some((node) => node.name === patch.name)) {
      setSelectedNodeName(patch.name)
    }
  }, [draft.config.nodes, updateNode])
  const deleteNode = useCallback((nodeName: string) => {
    apply({ type: "delete_node", nodeName })
    if (nodeName === selectedNodeName) setSelectedNodeName(draft.config.initial_node)
  }, [apply, draft.config.initial_node, selectedNodeName])
  const addEdge = useCallback((source: string, edge: AgentEdge) => apply({ type: "add_edge", source, edge }), [apply])
  const updateEdge = useCallback((source: string, functionName: string, patch: Partial<AgentEdge>) => apply({ type: "update_edge", source, functionName, patch }), [apply])
  const deleteEdge = useCallback((source: string, functionName: string) => apply({ type: "delete_edge", source, functionName }), [apply])
  const connectTransition = useCallback((source: string, target: string, sourceHandle?: string | null) => {
    const sourceNode = draft.config.nodes.find((node) => node.name === source)
    const targetNode = draft.config.nodes.find((node) => node.name === target)
    if (!sourceNode || !targetNode) return
    if (sourceHandle?.startsWith("transition:")) {
      updateEdge(source, sourceHandle.slice("transition:".length), { target })
      return
    }
    let index = sourceNode.edges.length + 1
    let functionName = `new_transition_${index}`
    while (sourceNode.edges.some((edge) => edge.function === functionName)) {
      index += 1
      functionName = `new_transition_${index}`
    }
    addEdge(source, { function: functionName, description: "", target, properties: {}, required: [] })
  }, [addEdge, draft.config.nodes, updateEdge])
  const moveNode = useCallback((nodeName: string, position: { x: number; y: number }) => apply({ type: "move_node", nodeName, position }), [apply])
  const setInitialNode = useCallback((nodeName: string) => apply({ type: "set_initial_node", nodeName }), [apply])
  const resetDraft = useCallback(() => {
    dispatch({ type: "reset", draft: initialDraft })
    setSelectedNodeName(exampleAgent.initial_node)
  }, [initialDraft])

  return {
    agent: draft.config,
    draft,
    selectedNode,
    selectedNodeName,
    selectNode: setSelectedNodeName,
    updateNode: updateNodeAndSelection,
    addNode,
    deleteNode,
    addEdge,
    updateEdge,
    deleteEdge,
    connectTransition,
    moveNode,
    setInitialNode,
    resetDraft,
    validationErrors,
    isDirty: JSON.stringify(draft) !== JSON.stringify(initialDraft),
  }
}
