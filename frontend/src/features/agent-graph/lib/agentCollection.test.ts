import { describe, expect, it } from "vitest"
import { exampleAgent } from "../data/exampleAgent"
import { createAgentCollection, createAgentId, createStoredAgent } from "./agentCollection"

describe("agent collection", () => {
  it("starts with one active agent", () => {
    const collection = createAgentCollection(exampleAgent)
    expect(collection.agents).toHaveLength(1)
    expect(collection.activeAgentId).toBe(collection.agents[0].id)
  })

  it("generates independent IDs for agents with the same name", () => {
    const first = createStoredAgent(exampleAgent)
    const second = createStoredAgent({ ...exampleAgent })
    expect(first.draft.config.name).toBe(second.draft.config.name)
    expect(first.id).not.toBe(second.id)
    expect(createAgentId()).toBeTruthy()
  })
})
