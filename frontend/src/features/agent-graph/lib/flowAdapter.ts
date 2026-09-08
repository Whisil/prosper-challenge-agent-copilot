import type { XYPosition } from "@xyflow/react"
import { NEW_TRANSITION_HANDLE, type AgentConfig, type AgentValidationError, type FlowEdge, type FlowNode } from "../model/type"
import { validationErrorsForNode } from "./validationPresentation"
import { defaultNodePosition } from "./graphLayout"
import { humanizeIdentifier } from "./identifier"

export const defaultLayout: Record<string, XYPosition> = {
  greeting: defaultNodePosition(0),
  collect_details: defaultNodePosition(1),
  offer_times: defaultNodePosition(2),
  confirm: defaultNodePosition(3),
}

export function toFlowElements(config: AgentConfig, layout: Record<string, XYPosition> = defaultLayout, validationErrors: AgentValidationError[] = []): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const connectedTargets = new Map<string, string[]>()
  config.nodes.forEach((node) => node.edges.forEach((edge) => connectedTargets.set(edge.target, [...(connectedTargets.get(edge.target) ?? []), "target"])))
  const nodes: FlowNode[] = config.nodes.map((node, index) => ({
    id: node.name,
    type: "agentNode",
    position: layout[node.name] ?? defaultNodePosition(index),
    data: { node, isInitial: node.name === config.initial_node, validationErrors: validationErrorsForNode(validationErrors, node.name), connectedSourceHandleIds: node.edges.length > 0 ? [NEW_TRANSITION_HANDLE] : [], connectedTargetHandleIds: connectedTargets.get(node.name) ?? [] },
  }))

  const edges: FlowEdge[] = config.nodes.flatMap((node) =>
    node.edges.map((edge) => ({
      id: `${node.name}-${edge.function}-${edge.target}`,
      source: node.name,
      sourceHandle: NEW_TRANSITION_HANDLE,
      target: edge.target,
      targetHandle: "target",
      data: { functionName: edge.function },
      type: "smoothstep",
      label: humanizeIdentifier(edge.function),
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
