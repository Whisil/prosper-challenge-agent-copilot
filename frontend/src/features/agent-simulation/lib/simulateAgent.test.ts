import { describe, expect, it } from "vitest"
import { exampleAgent } from "@/features/agent-graph/data/exampleAgent"
import { runtimeConfigToDocument } from "@/features/agent-graph/lib/agentDocument"
import { simulateAgent } from "./simulateAgent"

describe("simulateAgent", () => {
  it("records a deterministic normal booking trace", () => {
    const result = simulateAgent(runtimeConfigToDocument(exampleAgent), "normal-booking")

    expect(result.status).toBe("completed")
    expect(result.events.map((event) => event.kind)).toEqual(["node_entered", "transition", "ended"])
  })

  it("marks tool failures for review", () => {
    const result = simulateAgent(runtimeConfigToDocument(exampleAgent), "tool-failure")

    expect(result.status).toBe("failed")
    expect(result.events.at(-1)?.kind).toBe("tool_call")
  })
})
