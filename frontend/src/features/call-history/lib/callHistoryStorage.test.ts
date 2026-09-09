import { describe, expect, it } from "vitest"
import { completedFromTerminalEvidence, hasTerminalEvidence, loadCallHistory, resolveCallReview, resolveTransitionDisplayName, sampleCall, summarizeTraceEvent, updateCallReview } from "./callHistoryStorage"

describe("call history storage", () => {
  it("starts with one clearly labelled sample call", () => {
    const records = loadCallHistory()

    expect(records).toHaveLength(1)
    expect(records[0].isSample).toBe(true)
    expect(records[0].agentName).toBe("Prosper Review Example")
  })

  it("recognizes a terminal trace before the backend status changes", () => {
    const session = { ...sampleCall, status: "connected" as const, endedAt: undefined }

    expect(hasTerminalEvidence(session)).toBe(true)
    expect(completedFromTerminalEvidence(session)).toMatchObject({ status: "completed", endedAt: sampleCall.events.at(-1)?.timestamp })
  })

  it("updates AI review on the selected record", () => {
    const review = { status: "passed" as const, summary: "No issue found.", issues: [], recommendedAction: "no_change" as const, reviewedAt: new Date().toISOString() }

    expect(updateCallReview(sampleCall.id, review)[0].review?.summary).toBe("No issue found.")
  })

  it("marks the source review resolved after an accepted fix", () => {
    const records = resolveCallReview(sampleCall.id)

    expect(records[0].review?.resolution).toBe("resolved")
    expect(records[0].reviewState).toBe("complete")
  })

  it("turns runtime events into human-readable steps", () => {
    const event = { timestamp: "2026-01-01T10:00:00.000Z", kind: "transition" as const, nodeId: "collect_details", edgeId: "edge-1", payload: { transitionName: "new_transition_2", sourceTitle: "Collect Details", targetTitle: "Offer Times" } }

    expect(resolveTransitionDisplayName(event)).toBe("New Transition 2")
    expect(summarizeTraceEvent(event).detail).toContain("Collect Details")
  })
})
