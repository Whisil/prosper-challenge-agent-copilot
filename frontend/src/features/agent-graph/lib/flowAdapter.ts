import type { XYPosition } from "@xyflow/react"
import { NEW_TRANSITION_HANDLE, type AgentConfig, type AgentValidationError, type EdgeHandleLayout, type FlowEdge, type FlowNode, type ConnectionSide } from "../model/type"
import { validationErrorsForNode } from "./validationPresentation"
import { defaultNodePosition } from "./graphLayout"
import { humanizeIdentifier } from "./identifier"
import { defaultEdgeHandleLayout, edgeHandleKey } from "./agentDocument"

export const defaultLayout: Record<string, XYPosition> = {
  greeting: defaultNodePosition(0),
  collect_details: defaultNodePosition(1),
  offer_times: defaultNodePosition(2),
  confirm: defaultNodePosition(3),
}

export function sourceHandleId(side: ConnectionSide) {
  return side === "bottom" ? NEW_TRANSITION_HANDLE : `connection-${side}`
}

export function targetHandleId(side: ConnectionSide) {
  return side === "left" ? "target" : `target-${side}`
}

export function handleSideFromSource(id: string | null | undefined): ConnectionSide | undefined {
  if (id === NEW_TRANSITION_HANDLE) return "bottom"
  return id?.startsWith("connection-") ? id.slice("connection-".length) as ConnectionSide : undefined
}

export function handleSideFromTarget(id: string | null | undefined): ConnectionSide | undefined {
  if (id === "target") return "left"
  return id?.startsWith("target-") ? id.slice("target-".length) as ConnectionSide : undefined
}

export function toFlowElements(config: AgentConfig, layout: Record<string, XYPosition> = defaultLayout, validationErrors: AgentValidationError[] = [], edgeHandles: Record<string, EdgeHandleLayout> = {}): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const connectedTargets = new Map<string, string[]>()
  const connectedSources = new Map<string, string[]>()
  config.nodes.forEach((node) => node.edges.forEach((edge, index) => {
    const handles = edgeHandles[edgeHandleKey(node.name, edge, index)] ?? defaultEdgeHandleLayout()
    connectedTargets.set(edge.target, [...(connectedTargets.get(edge.target) ?? []), targetHandleId(handles.target)])
    connectedSources.set(node.name, [...(connectedSources.get(node.name) ?? []), sourceHandleId(handles.source)])
  }))
  const nodes: FlowNode[] = config.nodes.map((node, index) => ({
    id: node.name,
    type: "agentNode",
    position: layout[node.name] ?? defaultNodePosition(index),
    data: { node, isInitial: node.name === config.initial_node, validationErrors: validationErrorsForNode(validationErrors, node.name), connectedSourceHandleIds: connectedSources.get(node.name) ?? [], connectedTargetHandleIds: connectedTargets.get(node.name) ?? [] },
  }))

  const edges: FlowEdge[] = config.nodes.flatMap((node) =>
    node.edges.map((edge, index) => {
      const handles = edgeHandles[edgeHandleKey(node.name, edge, index)] ?? defaultEdgeHandleLayout()
      return ({
      id: edgeHandleKey(node.name, edge, index),
      source: node.name,
      sourceHandle: sourceHandleId(handles.source),
      target: edge.target,
      targetHandle: targetHandleId(handles.target),
      data: { functionName: edge.function },
      type: "smoothstep",
      label: humanizeIdentifier(edge.function),
      labelStyle: { fill: "#68736c", fontSize: 11, fontWeight: 600 },
      labelBgStyle: { fill: "#ffffff", fillOpacity: 0.95 },
      labelBgPadding: [8, 5] as [number, number],
      labelBgBorderRadius: 6,
      style: { stroke: "#aeb9b0", strokeWidth: 1.5 },
      markerEnd: { type: "arrowclosed", color: "#aeb9b0" },
    })}),
  )

  return { nodes, edges }
}
