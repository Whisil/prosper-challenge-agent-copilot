import { afterEach, describe, expect, it, vi } from "vitest"
import { createStoredAgent } from "@/features/agent-graph/lib/agentCollection"
import { exampleAgent } from "@/features/agent-graph/data/exampleAgent"
import { completedFromTerminalEvidence, hasTerminalEvidence, loadCallHistory, reportDeveloperIssue, resolveCallReview, resolveTransitionDisplayName, sampleCall, summarizeTraceEvent, updateCallReview } from "./callHistoryStorage"

describe("call history storage", () => {
  afterEach(() => vi.unstubAllGlobals())

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

  it("keeps unavailable reviews in an unavailable lifecycle state", () => {
    const review = { status: "unavailable" as const, summary: "The backend timed out.", issues: [], recommendedAction: "no_change" as const, reviewedAt: new Date().toISOString(), error: "Request timed out." }

    expect(updateCallReview(sampleCall.id, review)[0].reviewState).toBe("unavailable")
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

  it("keeps transcript evidence separate from the runtime trace", () => {
    expect(sampleCall.transcript).toHaveLength(2)
    expect(sampleCall.events.some((event) => event.kind === "transition")).toBe(true)
    expect(sampleCall.transcript?.[0]).toMatchObject({ role: "user", text: expect.any(String) })
  })

  it("explains a blocked runtime transition", () => {
    const summary = summarizeTraceEvent({ timestamp: "2026-01-01T10:00:00.000Z", kind: "validation_failed", nodeId: "verify_identity", message: "Transition 'verification_passed' field 'verification_status' must be one of: verified." })

    expect(summary.title).toBe("A step was blocked")
    expect(summary.detail).toContain("verification_status")
  })

  it("summarizes runtime-defect evidence for a call", () => {
    expect(summarizeTraceEvent({ timestamp: "2026-01-01T10:00:00.000Z", kind: "runtime_defect", message: "Success route was missing." }).title).toBe("Runtime issue detected")
  })

  it("stores a developer report only on the originating call", () => {
    const records = reportDeveloperIssue(sampleCall.id, "The tool did not continue after success.")

    expect(records[0].developerReport).toMatchObject({ summary: "The tool did not continue after success.", sessionId: sampleCall.id })
  })

  it("associates older calls with a matching stored agent", () => {
    const agent = createStoredAgent({ ...exampleAgent, name: sampleCall.agentName ?? exampleAgent.name })
    const storage = new Map<string, string>([["prosper-call-history-v1", JSON.stringify([sampleCall])]])
    vi.stubGlobal("window", { localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } })

    expect(loadCallHistory([agent])[0].agentId).toBe(agent.id)
  })
})
