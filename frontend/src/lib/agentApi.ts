import type { AgentDocument, TestSession } from "@/features/agent-graph/model/type"

const API_URL = import.meta.env.VITE_AGENT_API_URL || "http://localhost:8000"

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { headers: { "Content-Type": "application/json" }, ...init })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `Agent API request failed (${response.status}).`)
  return payload as T
}

export function activateAgentDraft(document: AgentDocument) {
  return request<{ active: boolean; version: number; agent: string }>("/api/draft", { method: "POST", body: JSON.stringify(document) })
}

export function createTestSession(draftVersion: string) {
  return request<TestSession>("/api/test-sessions", { method: "POST", body: JSON.stringify({ draftVersion }) })
}

export function getTestSession(sessionId: string) {
  return request<TestSession>(`/api/test-sessions/${sessionId}`)
}
