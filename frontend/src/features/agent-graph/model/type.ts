import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react"

export interface AgentTaskMessage {
  role: string
  content: string
}

export interface AgentProperty {
  type: string
  enum?: string[]
  description?: string
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

export interface AgentNodeData extends Record<string, unknown> {
  node: AgentNode
  isInitial: boolean
}

export type FlowNode = ReactFlowNode<AgentNodeData, "agentNode">
export type FlowEdge = ReactFlowEdge
