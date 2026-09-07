import type { Edge as ReactFlowEdge } from "@xyflow/react"
import type { AgentConfig, FlowNode } from "../model/type"

const positions: Record<string, { x: number; y: number }> = {
  greeting: { x: 230, y: 40 },
  collect_details: { x: 230, y: 235 },
  offer_times: { x: 230, y: 430 },
  confirm: { x: 230, y: 625 },
}

function titleForNode(name: string) {
  return name
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function toFlowElements(config: AgentConfig): { nodes: FlowNode[]; edges: ReactFlowEdge[] } {
  const nodes: FlowNode[] = config.nodes.map((node, index) => ({
    id: node.name,
    type: "agentNode",
    position: positions[node.name] ?? { x: 230, y: index * 195 },
    data: { node, isInitial: node.name === config.initial_node },
  }))

  const edges: ReactFlowEdge[] = config.nodes.flatMap((node) =>
    node.edges.map((edge) => ({
      id: `${node.name}-${edge.function}-${edge.target}`,
      source: node.name,
      target: edge.target,
      type: "smoothstep",
      label: titleForNode(edge.function),
      labelStyle: { fill: "#68736c", fontSize: 11, fontWeight: 600 },
      labelBgStyle: { fill: "#ffffff", fillOpacity: 0.95 },
      labelBgPadding: [8, 5] as [number, number],
      labelBgBorderRadius: 6,
      style: { stroke: "#aeb9b0", strokeWidth: 1.5 },
      markerEnd: { type: "arrowclosed", color: "#aeb9b0" },
    })),
  )

  return { nodes, edges }
}
