import type { CallRecord } from "@/features/agent-graph/model/type"

export const CALL_HISTORY_STORAGE_KEY = "prosper-call-history-v1"

const demoCalls: CallRecord[] = [
  {
    id: "demo-premature-disclosure",
    title: "Demo · availability before verification",
    draftVersion: "prosper_scheduler-v1",
    status: "completed",
    startedAt: "2026-01-01T10:00:00.000Z",
    endedAt: "2026-01-01T10:02:00.000Z",
    isDemo: true,
    feedback: "The agent offered appointment availability before verifying the caller's identity.",
    events: [
      { timestamp: "2026-01-01T10:00:01.000Z", kind: "node_entered", nodeId: "greeting", message: "Entered Greeting." },
      { timestamp: "2026-01-01T10:00:20.000Z", kind: "transition", nodeId: "greeting", edgeId: "greeting-choose_intent-1", message: "Followed Choose Intent.", payload: { target: "offer_times" } },
      { timestamp: "2026-01-01T10:01:10.000Z", kind: "node_entered", nodeId: "offer_times", message: "Entered Offer Times." },
      { timestamp: "2026-01-01T10:02:00.000Z", kind: "ended", message: "Demo call ended.", payload: { status: "completed" } },
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
    feedback: "The caller requested a human, but the scheduling flow continued.",
    events: [
      { timestamp: "2026-01-01T11:00:01.000Z", kind: "node_entered", nodeId: "greeting", message: "Entered Greeting." },
      { timestamp: "2026-01-01T11:00:40.000Z", kind: "transition", nodeId: "greeting", edgeId: "greeting-choose_intent-1", message: "Followed Choose Intent.", payload: { target: "collect_details" } },
      { timestamp: "2026-01-01T11:02:00.000Z", kind: "ended", message: "Demo call ended.", payload: { status: "completed" } },
    ],
  },
]

function parse(value: string | null): CallRecord[] {
  if (!value) return demoCalls
  try {
    const records = JSON.parse(value)
    return Array.isArray(records) ? records as CallRecord[] : demoCalls
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
  const next = [record, ...loadCallHistory().filter((current) => current.id !== record.id)]
  saveCallHistory(next)
  return next
}

export function updateCallFeedback(id: string, feedback: string): CallRecord[] {
  const next = loadCallHistory().map((record) => record.id === id ? { ...record, feedback } : record)
  saveCallHistory(next)
  return next
}
