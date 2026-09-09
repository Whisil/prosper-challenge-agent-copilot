import { describe, expect, it } from "vitest"
import { showcaseAgent } from "../data/agentTemplates"
import { exampleAgent } from "../data/exampleAgent"
import { createAgentCollection, createAgentId, createStoredAgent } from "./agentCollection"

describe("agent collection", () => {
  it("starts with exactly one active agent", () => {
    const collection = createAgentCollection(exampleAgent)
    expect(collection.agents).toHaveLength(1)
    expect(collection.activeAgentId).toBe(collection.agents[0].id)
  })

  it("can bootstrap the showcase as the only fresh agent", () => {
    const collection = createAgentCollection(showcaseAgent)
    expect(collection.agents).toHaveLength(1)
    expect(collection.agents[0].draft.config.name).toBe("Prosper Flow Test Agent")
  })

  it("generates independent IDs for agents with the same name", () => {
    const first = createStoredAgent(exampleAgent)
    const second = createStoredAgent({ ...exampleAgent })
    expect(first.draft.config.name).toBe(second.draft.config.name)
    expect(first.id).not.toBe(second.id)
    expect(createAgentId()).toBeTruthy()
  })
})
