import { useMemo, useState } from "react"
import { exampleAgent } from "../data/exampleAgent"

export function useAgentGraph() {
  const [selectedNodeName, setSelectedNodeName] = useState(exampleAgent.initial_node)
  const selectedNode = useMemo(
    () => exampleAgent.nodes.find((node) => node.name === selectedNodeName) ?? exampleAgent.nodes[0],
    [selectedNodeName],
  )

  return {
    agent: exampleAgent,
    selectedNode,
    selectedNodeName,
    selectNode: setSelectedNodeName,
  }
}
