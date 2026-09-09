import type { CallRecord, CallReview, TestSession, TraceEvent } from "@/features/agent-graph/model/type"
import { humanizeIdentifier } from "@/features/agent-graph/lib/identifier"

export const CALL_HISTORY_STORAGE_KEY = "prosper-call-history-v1"

export interface TraceSummary {
  title: string
  detail: string
  tone: "pass" | "warning" | "neutral"
}

export const sampleCall: CallRecord = {
  id: "sample-availability-before-verification",
  title: "Sample call · availability shown too early",
  agentName: "Prosper Review Example",
  draftVersion: "prosper_review_example-v1",
  status: "completed",
  startedAt: "2026-01-01T10:00:00.000Z",
  endedAt: "2026-01-01T10:01:00.000Z",
  isSample: true,
  reviewState: "complete",
  review: {
    status: "needs_attention",
    summary: "Appointment availability was shared before the caller's identity was verified.",
    recommendedAction: "propose_changes",
    reviewedAt: "2026-01-01T10:01:05.000Z",
    issues: [{ title: "Verification was skipped", explanation: "The booking route moves directly from Caller Request to Share Availability without a verification step.", severity: "high", nodeId: "share_availability", edgeId: "request_to_availability" }],
  },
  events: [
    { timestamp: "2026-01-01T10:00:01.000Z", kind: "node_entered", nodeId: "caller_request", message: "The call started.", payload: { nodeTitle: "Caller Request", isEntry: true } },
    { timestamp: "2026-01-01T10:00:20.000Z", kind: "transition", nodeId: "caller_request", edgeId: "request_to_availability", message: "The caller asked to book.", payload: { sourceTitle: "Caller Request", transitionName: "book_appointment", targetTitle: "Share Availability" } },
    { timestamp: "2026-01-01T10:00:22.000Z", kind: "node_entered", nodeId: "share_availability", message: "Appointment options were shared.", payload: { nodeTitle: "Share Availability" } },
    { timestamp: "2026-01-01T10:01:00.000Z", kind: "ended", nodeId: "booking_complete", message: "The call ended.", payload: { nodeTitle: "Booking Complete", isTerminal: true } },
  ],
}

export function resolveTransitionDisplayName(event: TraceEvent): string {
  const payload = event.payload ?? {}
  const payloadName = typeof payload.transitionName === "string" && payload.transitionName.trim() ? payload.transitionName : undefined
  const messageName = event.message?.match(/(?:via|transition(?:ed)?\s+via)\s+([A-Za-z0-9_-]+)/i)?.[1]
  const edgeParts = event.edgeId?.split("-") ?? []
  const edgeName = edgeParts.length > 2 ? edgeParts.slice(1, -1).join("_") : event.edgeId
  return humanizeIdentifier(payloadName ?? messageName ?? edgeName ?? "the next route")
}

export function summarizeTraceEvent(event: TraceEvent): TraceSummary {
  const payload = event.payload ?? {}
  const nodeTitle = typeof payload.nodeTitle === "string" ? payload.nodeTitle : humanizeIdentifier(event.nodeId ?? "the next step")
  const sourceTitle = typeof payload.sourceTitle === "string" ? payload.sourceTitle : humanizeIdentifier(event.nodeId ?? "the current step")
  const targetTitle = typeof payload.targetTitle === "string" ? payload.targetTitle : humanizeIdentifier(typeof payload.target === "string" ? payload.target : "the next step")
  const transitionName = resolveTransitionDisplayName(event)
  switch (event.kind) {
    case "node_entered":
      return { title: `${nodeTitle} started`, detail: typeof payload.explanation === "string" ? payload.explanation : event.message ?? `The agent began the ${nodeTitle} step.`, tone: "neutral" }
    case "transition":
      return { title: `${transitionName} used`, detail: typeof payload.sourceTitle === "string" && typeof payload.targetTitle === "string" ? `The caller moved from ${sourceTitle} to ${targetTitle} through this route.` : event.message ?? `The caller used ${transitionName}.`, tone: "pass" }
    case "tool_call":
      return { title: `${humanizeIdentifier(typeof payload.toolName === "string" ? payload.toolName : "Tool action")} ran`, detail: event.message ?? `The agent used the ${nodeTitle} action.`, tone: "pass" }
    case "handoff":
      return { title: "Call handed to staff", detail: event.message ?? `The caller was transferred from ${nodeTitle}.`, tone: "warning" }
    case "ended":
      return { title: "Call completed", detail: event.message ?? "The conversation ended.", tone: event.payload?.status === "failed" ? "warning" : "pass" }
  }
}

export function hasTerminalEvidence(session: TestSession): boolean {
  return session.events.some((event) => event.kind === "ended" || event.kind === "handoff" || event.payload?.isTerminal === true)
}

export function completedFromTerminalEvidence(session: TestSession): TestSession {
  const terminalEvent = [...session.events].reverse().find((event) => event.kind === "ended" || event.kind === "handoff" || event.payload?.isTerminal === true)
  return { ...session, status: session.status === "failed" ? "failed" : "completed", endedAt: session.endedAt ?? terminalEvent?.timestamp ?? new Date().toISOString() }
}

function mergeSampleCall(records: CallRecord[]): CallRecord[] {
  const existingSample = records.find((record) => record.id === sampleCall.id)
  const resolution = existingSample?.review?.resolution
  return [{ ...sampleCall, isSample: true, ...(resolution ? { review: { ...sampleCall.review, resolution } } : {}) }, ...records.filter((record) => record.id !== sampleCall.id && record.id !== "demo-premature-disclosure" && record.id !== "demo-human-request")]
}

function parse(value: string | null): CallRecord[] {
  if (!value) return [sampleCall]
  try {
    const records = JSON.parse(value)
    if (!Array.isArray(records)) return [sampleCall]
    return mergeSampleCall(records.map((record) => {
      const normalized = { ...(record as CallRecord & { feedback?: string; issueFlag?: unknown; isDemo?: boolean }) }
      delete normalized.feedback
      delete normalized.issueFlag
      delete normalized.isDemo
      if ((normalized.status === "completed" || normalized.status === "failed") && !normalized.review) {
        normalized.reviewState = "unavailable"
        normalized.review = { status: "unavailable", summary: "This call has not been reviewed yet.", issues: [], recommendedAction: "no_change", reviewedAt: new Date().toISOString(), error: "Review is unavailable for this older call. Retry AI review to inspect it." }
      }
      return normalized
    }))
  } catch {
    return [sampleCall]
  }
}

export function loadCallHistory(): CallRecord[] {
  if (typeof window === "undefined") return [sampleCall]
  const records = parse(window.localStorage.getItem(CALL_HISTORY_STORAGE_KEY))
  saveCallHistory(records)
  return records
}

export function saveCallHistory(records: CallRecord[]): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(CALL_HISTORY_STORAGE_KEY, JSON.stringify(records.slice(0, 20)))
}

export function upsertCallRecord(record: CallRecord): CallRecord[] {
  const previous = loadCallHistory().find((current) => current.id === record.id)
  const next = [{ ...record, review: record.review ?? previous?.review, reviewState: record.reviewState ?? previous?.reviewState, agentName: record.agentName ?? previous?.agentName }, ...loadCallHistory().filter((current) => current.id !== record.id)]
  saveCallHistory(next)
  return next
}

export function updateCallReview(id: string, review: CallReview): CallRecord[] {
  const next = loadCallHistory().map((record) => record.id === id ? { ...record, review, reviewState: "complete" as const } : record)
  saveCallHistory(next)
  return next
}

export function resolveCallReview(id: string): CallRecord[] {
  const next = loadCallHistory().map((record) => record.id === id && record.review
    ? { ...record, review: { ...record.review, resolution: "resolved" as const }, reviewState: "complete" as const }
    : record)
  saveCallHistory(next)
  return next
}
