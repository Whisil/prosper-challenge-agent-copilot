import type { XYPosition } from "@xyflow/react"
import type { AgentDocument, AgentDraft, AgentEdge, AgentNode, AgentProperty, AgentTaskMessage, AgentToolConfig, AgentTransferConfig, AgentValidationError, CallRecord, CallReview, AgentEdgeKind } from "@/features/agent-graph/model/type"

export type SuggestedFixOperation =
  | { op: "add_node"; node: AgentNode; position?: XYPosition }
  | { op: "add_edge"; sourceNodeId: string; edge: AgentEdge }
  | { op: "update_edge"; edgeId: string; patch: { target?: string; description?: string; kind?: AgentEdgeKind; properties?: Record<string, AgentProperty>; required?: string[] } }
  | { op: "update_node"; nodeId: string; patch: { title?: string; task_messages?: AgentTaskMessage[]; role_message?: string | null; tool?: AgentToolConfig | null; transfer?: AgentTransferConfig | null } }

export interface SuggestedFixRequest {
  document: AgentDocument
  baseVersion: string
  call: CallRecord
  review: CallReview
}

export interface SuggestedFixResponse {
  id: string
  baseVersion: string
  sourceCallId: string
  mode: "ai" | "sample_fallback"
  diagnosis: string
  operations: SuggestedFixOperation[]
  changes: string[]
  createdAt: string
}

export type SuggestedFixStatus = "idle" | "loading" | "ready" | "stale" | "error"

export interface SuggestedFixState {
  status: SuggestedFixStatus
  source?: SuggestedFixRequest
  response?: SuggestedFixResponse
  originalDraft?: AgentDraft
  previewDraft?: AgentDraft
  error?: string
}

export interface SuggestedFixPreview {
  draft: AgentDraft
  errors: AgentValidationError[]
}
