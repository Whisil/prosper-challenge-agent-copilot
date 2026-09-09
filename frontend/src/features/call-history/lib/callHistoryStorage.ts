import type { CallRecord, CallReview, TraceEvent } from "@/features/agent-graph/model/type"

export const CALL_HISTORY_STORAGE_KEY = "prosper-call-history-v1"

export interface TraceSummary {
  title: string
  detail: string
  tone: "pass" | "warning" | "neutral"
}

const demoCalls: CallRecord[] = [
  {
    id: "demo-premature-disclosure",
    title: "Demo · availability before verification",
    draftVersion: "prosper_scheduler-v1",
    status: "completed",
    startedAt: "2026-01-01T10:00:00.000Z",
    endedAt: "2026-01-01T10:02:00.000Z",
    isDemo: true,
    review: {
      status: "needs_attention",
      summary: "The agent reached appointment availability before the caller's identity was verified.",
      recommendedAction: "propose_changes",
      reviewedAt: "2026-01-01T10:02:05.000Z",
      issues: [{ title: "Verification was skipped", explanation: "Availability was disclosed after the intent transition without a verification step.", severity: "high", nodeId: "offer_times" }],
    },
    events: [
      { timestamp: "2026-01-01T10:00:01.000Z", kind: "node_entered", nodeId: "greeting", message: "The agent opened the call." },
      { timestamp: "2026-01-01T10:00:20.000Z", kind: "transition", nodeId: "greeting", edgeId: "greeting-choose_intent-1", message: "The caller asked to schedule an appointment.", payload: { target: "offer_times" } },
      { timestamp: "2026-01-01T10:01:10.000Z", kind: "node_entered", nodeId: "offer_times", message: "The agent entered appointment availability." },
      { timestamp: "2026-01-01T10:02:00.000Z", kind: "ended", message: "The demo call ended normally.", payload: { status: "completed" } },
    ],
  },
  {
    id: "demo-human-request",
    title: "Demo · missed human request",
    draftVersion: "prosper_scheduler-v1",
    status: "completed",
    startedAt: "2026-01-01T11:00:00.000Z",
    endedAt: "2026-01-01T11:02:00.000Z",
    isDemo: true,
    review: {
      status: "needs_attention",
      summary: "The caller asked for a human, but the flow continued through scheduling instead of handing off.",
      recommendedAction: "propose_changes",
      reviewedAt: "2026-01-01T11:02:05.000Z",
      issues: [{ title: "Human handoff was missed", explanation: "The caller's request was not represented by a transfer path.", severity: "high", nodeId: "greeting" }],
    },
    events: [
      { timestamp: "2026-01-01T11:00:01.000Z", kind: "node_entered", nodeId: "greeting", message: "The agent opened the call." },
      { timestamp: "2026-01-01T11:00:40.000Z", kind: "transition", nodeId: "greeting", edgeId: "greeting-choose_intent-1", message: "The flow continued to collect appointment details.", payload: { target: "collect_details" } },
      { timestamp: "2026-01-01T11:02:00.000Z", kind: "ended", message: "The demo call ended without a handoff.", payload: { status: "completed" } },
    ],
  },
]

export function summarizeTraceEvent(event: TraceEvent): TraceSummary {
  switch (event.kind) {
    case "node_entered":
      return { title: "Conversation step started", detail: event.message ?? `The agent moved to ${event.nodeId ?? "the next step"}.`, tone: "neutral" }
    case "transition":
      return { title: "Conversation moved forward", detail: event.message ?? `The caller moved the flow via ${event.edgeId ?? "a transition"}.`, tone: "pass" }
    case "tool_call":
      return { title: "Action was used", detail: event.message ?? "The agent used a configured action.", tone: "pass" }
    case "handoff":
      return { title: "Call handed to staff", detail: event.message ?? "The agent transferred the caller to a human team.", tone: "pass" }
    case "ended":
      return { title: "Call completed", detail: event.message ?? "The conversation ended.", tone: event.payload?.status === "failed" ? "warning" : "pass" }
  }
}

function parse(value: string | null): CallRecord[] {
  if (!value) return demoCalls
  try {
    const records = JSON.parse(value)
    return Array.isArray(records) ? records.map((record) => {
      if (!record || typeof record !== "object") return record
      const withoutLegacyFeedback = { ...(record as CallRecord & { feedback?: string }) }
      delete withoutLegacyFeedback.feedback
      return withoutLegacyFeedback as CallRecord
    }) : demoCalls
  } catch {
    return demoCalls
  }
}

export function loadCallHistory(): CallRecord[] {
  if (typeof window === "undefined") return demoCalls
  return parse(window.localStorage.getItem(CALL_HISTORY_STORAGE_KEY))
}

export function saveCallHistory(records: CallRecord[]): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(CALL_HISTORY_STORAGE_KEY, JSON.stringify(records.slice(0, 20)))
}

export function upsertCallRecord(record: CallRecord): CallRecord[] {
  const previous = loadCallHistory().find((current) => current.id === record.id)
  const next = [{ ...record, review: record.review ?? previous?.review }, ...loadCallHistory().filter((current) => current.id !== record.id)]
  saveCallHistory(next)
  return next
}

export function updateCallReview(id: string, review: CallReview): CallRecord[] {
  const next = loadCallHistory().map((record) => record.id === id ? { ...record, review } : record)
  saveCallHistory(next)
  return next
}
