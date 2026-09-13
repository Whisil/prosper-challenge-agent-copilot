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
export const agentNodeTypes = ["conversation", "tool", "transfer", "end"] as const
export type AgentNodeType = (typeof agentNodeTypes)[number]

export const agentEdgeKinds = ["condition", "success", "failure"] as const
export type AgentEdgeKind = (typeof agentEdgeKinds)[number]

export const NEW_TRANSITION_HANDLE = "new-transition"
export type ConnectionSide = "top" | "right" | "bottom" | "left"

export interface EdgeHandleLayout {
  source: ConnectionSide
  target: ConnectionSide
}

export type NodeCreationKind = AgentNodeType

export interface NodeCreationInput {
  name: string
  title?: string
  instruction?: string
  roleMessage?: string
  type?: AgentNodeType
  tool?: AgentToolConfig
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
  tool?: AgentToolConfig | null
  transfer?: AgentTransferConfig | null
}

export interface AgentToolConfig {
  name: string
  description: string
  confirmationRequired?: boolean
  mockResult?: Record<string, unknown>
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
  edgeHandles: Record<string, EdgeHandleLayout>
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

export type TraceEventKind = "node_entered" | "transition" | "tool_call" | "handoff" | "ended" | "validation_failed" | "runtime_defect"

export interface TraceEvent {
  timestamp: string
  kind: TraceEventKind
  nodeId?: string
  edgeId?: string
  message?: string
  payload?: Record<string, unknown>
}

export interface TranscriptTurn {
  id: string
  role: "user" | "assistant"
  text: string
  timestamp: string
  interrupted?: boolean
}

export interface TestSession {
  id: string
  draftVersion: string
  status: "starting" | "connected" | "completed" | "failed"
  startedAt: string
  endedAt?: string
  events: TraceEvent[]
  transcript?: TranscriptTurn[]
  transcriptTruncated?: boolean
}

export interface DeveloperReport {
  id: string
  createdAt: string
  summary: string
  draftVersion: string
  sessionId: string
  eventKinds: TraceEventKind[]
}

export interface CallReviewIssue {
  title: string
  explanation: string
  severity: "low" | "medium" | "high"
  nodeId?: string
  edgeId?: string
  evidenceTurnIds?: string[]
  observedBehavior?: string
  expectedBehavior?: string
  resolutionType?: "graph_change" | "runtime_defect" | "no_action"
}

export interface CallReview {
  status: "passed" | "needs_attention" | "unavailable"
  summary: string
  issues: CallReviewIssue[]
  recommendedAction: "no_change" | "propose_changes" | "report_development"
  reviewedAt: string
  error?: string
  resolution?: "resolved"
  evidenceQuality?: "trace_and_transcript" | "trace_only" | "incomplete"
}

export interface CallRecord extends TestSession {
  title: string
  agentId?: string
  agentName?: string
  isSample?: boolean
  review?: CallReview
  reviewState?: "pending" | "complete" | "unavailable"
  developerReport?: DeveloperReport
}

export type ImprovementDecision = "unreviewed" | "no_change" | "accepted" | "rejected"

export interface AcceptedImprovementChange {
  kind: "added_node" | "added_edge" | "updated_node" | "updated_edge"
  id: string
  beforeTarget?: string
  afterTarget?: string
}

export interface ImprovementRecord {
  id: string
  agentId: string
  callId: string
  draftVersion: string
  createdAt: string
  outcome: "completed" | "failed"
  summary: string
  reviewStatus: "pending" | "passed" | "needs_attention" | "unavailable"
  issues: CallReviewIssue[]
  decision: ImprovementDecision
  appliedVersion?: string
  affectedNodeIds?: string[]
  affectedEdgeIds?: string[]
  acceptedChanges?: AcceptedImprovementChange[]
  proposedChanges?: string[]
}

export type AgentEditorAction =
  | { type: "reset"; draft: AgentDraft }
  | { type: "update_agent"; patch: AgentSettingsPatch }
  | { type: "update_node"; nodeName: string; patch: Partial<AgentNode> }
  | { type: "add_node"; node: AgentNode; position: XYPosition }
  | { type: "delete_node"; nodeName: string }
  | { type: "set_initial_node"; nodeName: string }
  | { type: "add_edge"; source: string; edge: AgentEdge; handles?: EdgeHandleLayout }
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
