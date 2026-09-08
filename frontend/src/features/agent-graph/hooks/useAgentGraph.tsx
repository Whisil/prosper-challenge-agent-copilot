import { useCallback, useMemo, useReducer, useState } from "react"
import { exampleAgent } from "../data/exampleAgent"
import { applyAgentAction, createAgentDraft } from "../lib/agentOperations"
import type { AgentEdge, AgentEditorAction, AgentNode } from "../model/type"

export function useAgentGraph() {
  const [draft, dispatch] = useReducer(applyAgentAction, exampleAgent, createAgentDraft)
  const [selectedNodeName, setSelectedNodeName] = useState(exampleAgent.initial_node)
  const selectedNode = useMemo(
    () => draft.config.nodes.find((node) => node.name === selectedNodeName) ?? draft.config.nodes[0],
    [draft.config.nodes, selectedNodeName],
  )
  const apply = useCallback((action: AgentEditorAction) => dispatch(action), [])
  const updateNode = useCallback((nodeName: string, patch: Partial<AgentNode>) => apply({ type: "update_node", nodeName, patch }), [apply])
  const addNode = useCallback((node: AgentNode, position: { x: number; y: number }) => {
    apply({ type: "add_node", node, position })
    setSelectedNodeName(node.name)
  }, [apply])
  const deleteNode = useCallback((nodeName: string) => {
    apply({ type: "delete_node", nodeName })
    if (nodeName === selectedNodeName) setSelectedNodeName(draft.config.initial_node)
  }, [apply, draft.config.initial_node, selectedNodeName])
  const addEdge = useCallback((source: string, edge: AgentEdge) => apply({ type: "add_edge", source, edge }), [apply])
  const updateEdge = useCallback((source: string, functionName: string, patch: Partial<AgentEdge>) => apply({ type: "update_edge", source, functionName, patch }), [apply])
  const deleteEdge = useCallback((source: string, functionName: string) => apply({ type: "delete_edge", source, functionName }), [apply])
  const moveNode = useCallback((nodeName: string, position: { x: number; y: number }) => apply({ type: "move_node", nodeName, position }), [apply])
  const setInitialNode = useCallback((nodeName: string) => apply({ type: "set_initial_node", nodeName }), [apply])
  const resetDraft = useCallback(() => {
    dispatch({ type: "reset", draft: createAgentDraft(exampleAgent) })
    setSelectedNodeName(exampleAgent.initial_node)
  }, [])

  return {
    agent: draft.config,
    draft,
    selectedNode,
    selectedNodeName,
    selectNode: setSelectedNodeName,
    updateNode,
    addNode,
    deleteNode,
    addEdge,
    updateEdge,
    deleteEdge,
    moveNode,
    setInitialNode,
    resetDraft,
  }
}
