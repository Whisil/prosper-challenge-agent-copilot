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

export const CURRENT_AGENT_DOCUMENT_VERSION = 1
export const agentNodeTypes = ["conversation", "tool", "branch", "transfer", "end"] as const
export type AgentNodeType = (typeof agentNodeTypes)[number]

export const agentEdgeKinds = ["condition", "default", "success", "failure"] as const
export type AgentEdgeKind = (typeof agentEdgeKinds)[number]

export const NEW_TRANSITION_HANDLE = "new-transition"

export type NodeCreationKind = AgentNodeType

export interface NodeCreationInput {
  name: string
  title?: string
  instruction: string
  roleMessage?: string
  type?: AgentNodeType
  tool?: AgentToolConfig
  branch?: AgentBranchConfig
  transfer?: AgentTransferConfig
}

export interface TransitionReference {
  source: string
  functionName: string
}

export interface ConnectionInteractionState {
  mode: "idle" | "creating"
}

export interface AgentEdge {
  id?: string
  kind?: AgentEdgeKind
  condition?: string
  function: string
  description: string
  target: string
  properties: Record<string, AgentProperty>
  required: string[]
}

export interface AgentNode {
  name: string
  id?: string
  title?: string
  type?: AgentNodeType
  task_messages: AgentTaskMessage[]
  role_message?: string | null
  edges: AgentEdge[]
  pre_actions?: unknown[]
  post_actions?: unknown[]
  end?: boolean
  tool?: AgentToolConfig
  branch?: AgentBranchConfig
  transfer?: AgentTransferConfig
}

export interface AgentToolConfig {
  name: string
  description: string
  confirmationRequired?: boolean
  mockResult?: Record<string, unknown>
}

export interface AgentBranchConfig {
  expression: string
}

export interface AgentTransferConfig {
  reason: string
  context?: string
}

export interface AgentConfig {
  name: string
  initial_node: string
  nodes: AgentNode[]
  persona: string
  voice_id: string
  model: string
}

export interface AgentDocument extends AgentConfig {
  version: number
  id: string
  revision: number
}

export interface AgentSettingsPatch {
  persona: string
}

export interface AgentDraft {
  config: AgentDocument
  layout: Record<string, XYPosition>
}

export interface StoredAgent {
  id: string
  draft: AgentDraft
  updatedAt: string
}

export interface AgentCollection {
  activeAgentId: string
  agents: StoredAgent[]
}

export interface AgentValidationLocation {
  nodeName?: string
  edgeFunction?: string
  propertyName?: string
  field?: string
}

export interface AgentValidationError {
  path: string
  message: string
  severity: "error" | "warning"
  location?: AgentValidationLocation
}

export type TraceEventKind = "node_entered" | "transition" | "tool_call" | "handoff" | "ended"

export interface TraceEvent {
  timestamp: string
  kind: TraceEventKind
  nodeId?: string
  edgeId?: string
  message?: string
  payload?: Record<string, unknown>
}

export interface TestSession {
  id: string
  draftVersion: string
  status: "starting" | "connected" | "completed" | "failed"
  startedAt: string
  endedAt?: string
  events: TraceEvent[]
}

export interface CallReviewIssue {
  title: string
  explanation: string
  severity: "low" | "medium" | "high"
  nodeId?: string
  edgeId?: string
}

export interface CallReview {
  status: "passed" | "needs_attention" | "unavailable"
  summary: string
  issues: CallReviewIssue[]
  recommendedAction: "no_change" | "propose_changes"
  reviewedAt: string
  error?: string
}

export interface CallRecord extends TestSession {
  title: string
  isDemo?: boolean
  review?: CallReview
}

export type AgentEditorAction =
  | { type: "reset"; draft: AgentDraft }
  | { type: "update_agent"; patch: AgentSettingsPatch }
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
  validationErrors: AgentValidationError[]
  connectedSourceHandleIds: string[]
  connectedTargetHandleIds: string[]
}

export type FlowNode = ReactFlowNode<AgentNodeData, "agentNode">
export interface AgentFlowEdgeData extends Record<string, unknown> {
  functionName: string
}

export type FlowEdge = ReactFlowEdge<AgentFlowEdgeData>
