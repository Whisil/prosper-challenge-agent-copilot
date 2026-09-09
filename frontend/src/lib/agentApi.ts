import type { AgentDocument, TestSession } from "@/features/agent-graph/model/type"
import type { ChangeProposal, CopilotProposalRequest, ReviewCallRequest } from "@/features/agent-copilot/model/type"
import type { CallReview } from "@/features/agent-graph/model/type"

const API_URL = import.meta.env.VITE_AGENT_API_URL || "http://127.0.0.1:8000"

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, { headers: { "Content-Type": "application/json" }, ...init })
  } catch {
    throw new Error(`Cannot reach the local control API at ${API_URL}. Start the backend with 'make run' and verify VITE_AGENT_API_URL.`)
  }
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `Agent API request failed (${response.status}).`)
  return payload as T
}

export function checkAgentApi() {
  return request<{ status: string }>("/api/health")
}

export function activateAgentDraft(document: AgentDocument) {
  return request<{ active: boolean; version: number; agent: string }>("/api/draft", { method: "POST", body: JSON.stringify(document) })
}

export function createTestSession(draftVersion: string, document?: AgentDocument) {
  return request<TestSession>("/api/test-sessions", { method: "POST", body: JSON.stringify({ draftVersion, document }) })
}

export function getTestSession(sessionId: string) {
  return request<TestSession>(`/api/test-sessions/${sessionId}`)
}

export function createCopilotProposal(payload: CopilotProposalRequest) {
  return request<ChangeProposal>("/api/copilot/propose", { method: "POST", body: JSON.stringify(payload) })
}

export function reviewCall(payload: ReviewCallRequest) {
  return request<CallReview>("/api/copilot/review-call", { method: "POST", body: JSON.stringify(payload) })
}
