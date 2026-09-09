import type { AgentDocument, CallRecord } from "@/features/agent-graph/model/type"
import type { GraphOperation } from "@/features/agent-graph/model/patch"
export type { GraphOperation, OperationPreview, OperationResult } from "@/features/agent-graph/model/patch"

export type EvidenceSource =
  | { kind: "call"; traceId: string; text: string; call?: CallRecord }
  | { kind: "guideline"; text: string }

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

export interface ReviewCallRequest {
  document: AgentDocument
  baseVersion: string
  call: CallRecord
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
