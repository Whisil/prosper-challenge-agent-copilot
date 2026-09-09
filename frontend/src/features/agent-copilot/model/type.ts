import type { XYPosition } from "@xyflow/react"
import type { AgentDocument, AgentEdge, AgentNode, AgentSettingsPatch, AgentValidationError, CallRecord } from "@/features/agent-graph/model/type"

export type EvidenceSource =
  | { kind: "call"; traceId: string; text: string; call?: CallRecord }
  | { kind: "feedback"; text: string }
  | { kind: "guideline"; text: string }

export type GraphOperation =
  | { op: "add_node"; node: AgentNode; position?: XYPosition }
  | { op: "update_node"; nodeId: string; patch: Partial<AgentNode> }
  | { op: "remove_node"; nodeId: string }
  | { op: "add_edge"; sourceNodeId: string; edge: AgentEdge }
  | { op: "update_edge"; edgeId: string; patch: Partial<AgentEdge> }
  | { op: "remove_edge"; edgeId: string }
  | { op: "update_agent"; patch: AgentSettingsPatch }

export type DiagnosisCategory = "prompt" | "transition" | "tool" | "data" | "integration" | "policy"
export type ProposalStatus = "draft" | "approved" | "rejected"

export interface ProposalRisk {
  severity: "low" | "medium" | "high"
  reason: string
}

export interface TestAssertion {
  id: string
  label: string
  expected: string
}

export interface TestCase {
  id: string
  name: string
  prompt: string
  expectedOutcome: string
  assertions: TestAssertion[]
}

export interface CopilotProposalRequest {
  document: AgentDocument
  baseVersion: string
  source: {
    kind: EvidenceSource["kind"]
    text: string
    call?: CallRecord
  }
}

export interface ChangeProposal {
  id: string
  baseVersion: string
  source: EvidenceSource
  diagnosis: { category: DiagnosisCategory; explanation: string; confidence: number }
  operations: GraphOperation[]
  assumptions: string[]
  questions: string[]
  risks: ProposalRisk[]
  tests: TestCase[]
  status: ProposalStatus
  createdAt: string
}

export interface OperationResult {
  operation: GraphOperation
  index: number
  accepted: boolean
  errors: AgentValidationError[]
}

export interface OperationPreview {
  document: AgentDocument
  layout: Record<string, XYPosition>
  results: OperationResult[]
  errors: AgentValidationError[]
}
