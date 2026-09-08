import type { Edge as ReactFlowEdge, Node as ReactFlowNode, XYPosition } from "@xyflow/react"

export interface AgentTaskMessage {
  role: string
  content: string
}

export interface AgentProperty {
  type: string
  enum?: string[]
  description?: string
}

export const supportedPropertyTypes = ["string", "number", "integer", "boolean"] as const
export type AgentPropertyType = (typeof supportedPropertyTypes)[number]

export const NEW_TRANSITION_HANDLE = "new-transition"

export function transitionHandleId(functionName: string) {
  return `transition:${functionName}`
}

export interface AgentEdge {
  function: string
  description: string
  target: string
  properties: Record<string, AgentProperty>
  required: string[]
}

export interface AgentNode {
  name: string
  task_messages: AgentTaskMessage[]
  role_message?: string | null
  edges: AgentEdge[]
  pre_actions?: unknown[]
  post_actions?: unknown[]
  end?: boolean
}

export interface AgentConfig {
  name: string
  initial_node: string
  nodes: AgentNode[]
  persona: string
  voice_id: string
  model: string
}

export interface AgentDraft {
  config: AgentConfig
  layout: Record<string, XYPosition>
}

export interface AgentValidationError {
  path: string
  message: string
  severity: "error" | "warning"
}

export type AgentEditorAction =
  | { type: "reset"; draft: AgentDraft }
  | { type: "update_node"; nodeName: string; patch: Partial<AgentNode> }
  | { type: "add_node"; node: AgentNode; position: XYPosition }
  | { type: "delete_node"; nodeName: string }
  | { type: "set_initial_node"; nodeName: string }
  | { type: "add_edge"; source: string; edge: AgentEdge }
  | { type: "update_edge"; source: string; functionName: string; patch: Partial<AgentEdge> }
  | { type: "delete_edge"; source: string; functionName: string }
  | { type: "move_node"; nodeName: string; position: XYPosition }

export interface AgentNodeData extends Record<string, unknown> {
  node: AgentNode
  isInitial: boolean
}

export type FlowNode = ReactFlowNode<AgentNodeData, "agentNode">
export type FlowEdge = ReactFlowEdge
