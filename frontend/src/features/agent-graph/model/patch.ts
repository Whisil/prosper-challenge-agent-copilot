import type { XYPosition } from "@xyflow/react"
import type { AgentDocument, AgentDraft, AgentEdge, AgentNode, AgentSettingsPatch, AgentValidationError } from "./type"

export type GraphOperation =
  | { op: "add_node"; node: AgentNode; position?: XYPosition }
  | { op: "update_node"; nodeId: string; patch: Partial<AgentNode> }
  | { op: "remove_node"; nodeId: string }
  | { op: "add_edge"; sourceNodeId: string; edge: AgentEdge }
  | { op: "update_edge"; edgeId: string; patch: Partial<AgentEdge> }
  | { op: "remove_edge"; edgeId: string }
  | { op: "update_agent"; patch: AgentSettingsPatch }

export interface OperationResult {
  operation: GraphOperation
  index: number
  accepted: boolean
  errors: AgentValidationError[]
}

export interface OperationPreview {
  document: AgentDocument
  layout: AgentDraft["layout"]
  edgeHandles: AgentDraft["edgeHandles"]
  results: OperationResult[]
  errors: AgentValidationError[]
}
