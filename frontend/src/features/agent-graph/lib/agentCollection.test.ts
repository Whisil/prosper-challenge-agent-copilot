import { describe, expect, it } from "vitest"
import { reviewExampleAgent, showcaseAgent } from "../data/agentTemplates"
import { exampleAgent } from "../data/exampleAgent"
import { createAgentCollection, createAgentId, createStoredAgent, ensureDefaultAgents, ensureShowcaseAgent } from "./agentCollection"

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

  it("adds the sample call's showcase agent without changing the active agent", () => {
    const existing = createStoredAgent(exampleAgent)
    const collection = { activeAgentId: existing.id, agents: [existing] }
    const ensured = ensureShowcaseAgent(collection)

    expect(ensured.activeAgentId).toBe(existing.id)
    expect(ensured.agents).toHaveLength(2)
    expect(ensured.agents.some((agent) => agent.draft.config.name === "Prosper Flow Test Agent")).toBe(true)
  })

  it("does not duplicate the showcase agent", () => {
    const collection = createAgentCollection(showcaseAgent)
    expect(ensureShowcaseAgent(collection).agents).toHaveLength(1)
  })

  it("adds the simple review agent alongside the showcase", () => {
    const collection = ensureDefaultAgents(createAgentCollection(showcaseAgent))
    expect(collection.agents.map((agent) => agent.draft.config.name)).toEqual([showcaseAgent.name, reviewExampleAgent.name])
  })
})
