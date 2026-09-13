import { afterEach, describe, expect, it, vi } from "vitest"
import type { CallRecord, StoredAgent } from "@/features/agent-graph/model/type"
import { exampleAgent } from "@/features/agent-graph/data/exampleAgent"
import { createStoredAgent } from "@/features/agent-graph/lib/agentCollection"
import { historicalContextForAgent, improvementRecordFromCall, loadImprovementMemory, updateImprovementDecision, updateImprovementReview } from "./improvementMemory"

function storage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  }
}

function call(agent: StoredAgent, id = "call-1"): CallRecord {
  return {
    id,
    title: "Test call",
    agentId: agent.id,
    agentName: agent.draft.config.name,
    draftVersion: `${agent.draft.config.id}-v1`,
    status: "completed",
    startedAt: "2026-01-01T10:00:00.000Z",
    endedAt: "2026-01-01T10:01:00.000Z",
    events: [{ timestamp: "2026-01-01T10:01:00.000Z", kind: "ended", nodeId: "done", payload: { isTerminal: true } }],
    review: { status: "needs_attention", summary: "A safety step was skipped.", issues: [{ title: "Missing verification", explanation: "Verify before sharing availability.", severity: "high", nodeId: "availability" }], recommendedAction: "propose_changes", reviewedAt: "2026-01-01T10:02:00.000Z" },
    reviewState: "complete",
  }
}

describe("improvement memory", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("migrates completed calls into compact per-agent records", () => {
    const agent = createStoredAgent(exampleAgent)
    vi.stubGlobal("window", { localStorage: storage() })

    const records = loadImprovementMemory([call(agent)], [agent])
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ agentId: agent.id, callId: "call-1", decision: "unreviewed" })
    expect(historicalContextForAgent(records, agent.id).records[0]).not.toHaveProperty("events")
  })

  it("keeps history isolated and limits it to the latest twenty records", () => {
    const first = createStoredAgent(exampleAgent)
    const second = createStoredAgent({ ...exampleAgent, name: "Other agent" })
    const records = Array.from({ length: 21 }, (_, index) => improvementRecordFromCall(call(first, `call-${index}`), [first])!).concat(improvementRecordFromCall(call(second, "other-call"), [second])!)

    expect(historicalContextForAgent(records, second.id).records).toHaveLength(1)
    expect(historicalContextForAgent(records, first.id).records).toHaveLength(20)
  })

  it("updates the same record when a review or decision changes", () => {
    const agent = createStoredAgent(exampleAgent)
    const source = call(agent)
    vi.stubGlobal("window", { localStorage: storage() })
    loadImprovementMemory([source], [agent])

    const updated = updateImprovementReview(source, [agent], { status: "passed", summary: "The path was safe.", issues: [], recommendedAction: "no_change", reviewedAt: "2026-01-01T10:03:00.000Z" })
    expect(updated).toHaveLength(1)
    expect(updated[0].decision).toBe("no_change")

    const accepted = updateImprovementDecision(source, [agent], "accepted", { appliedVersion: "agent-v2", affectedNodeIds: ["verify_identity"] })
    expect(accepted).toHaveLength(1)
    expect(accepted[0]).toMatchObject({ decision: "accepted", appliedVersion: "agent-v2", affectedNodeIds: ["verify_identity"] })
  })

  it("does not need a document snapshot to describe a decision", () => {
    const agent = createStoredAgent(exampleAgent)
    const record = improvementRecordFromCall(call(agent), [agent])
    expect(record).toBeDefined()
    expect(record).not.toHaveProperty("document")
    expect(record).not.toHaveProperty("trace")
  })

  it("keeps unavailable reviews distinct from no-change reviews", () => {
    const agent = createStoredAgent(exampleAgent)
    const source = { ...call(agent), review: { status: "unavailable" as const, summary: "The backend timed out.", issues: [], recommendedAction: "no_change" as const, reviewedAt: "2026-01-01T10:02:00.000Z", error: "Request timed out." }, reviewState: "unavailable" as const }
    vi.stubGlobal("window", { localStorage: storage() })

    const records = loadImprovementMemory([source], [agent])
    expect(records[0]).toMatchObject({ reviewStatus: "unavailable", decision: "unreviewed" })
  })
})
