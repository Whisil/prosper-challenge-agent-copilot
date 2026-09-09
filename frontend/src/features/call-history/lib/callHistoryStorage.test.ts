import { describe, expect, it } from "vitest"
import { loadCallHistory, summarizeTraceEvent, updateCallReview } from "./callHistoryStorage"

describe("call history storage", () => {
  it("starts with clearly labeled synthetic evidence", () => {
    expect(loadCallHistory().length).toBeGreaterThanOrEqual(2)
    expect(loadCallHistory().every((record) => record.isDemo)).toBe(true)
  })

  it("updates AI review on the selected record", () => {
    const records = loadCallHistory()
    const review = { status: "passed" as const, summary: "No issue found.", issues: [], recommendedAction: "no_change" as const, reviewedAt: new Date().toISOString() }
    expect(updateCallReview(records[0].id, review)[0].review?.summary).toBe("No issue found.")
  })

  it("turns runtime events into human-readable steps", () => {
    expect(summarizeTraceEvent({ timestamp: "2026-01-01T10:00:00Z", kind: "node_entered", nodeId: "greeting" }).title).toBe("Conversation step started")
  })
})
