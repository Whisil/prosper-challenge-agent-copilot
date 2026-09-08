import { describe, expect, it } from "vitest"
import { exampleAgent } from "../data/exampleAgent"
import { applyAgentAction, createAgentDraft } from "./agentOperations"

function draftWithExample() {
  return createAgentDraft(exampleAgent)
}

describe("agent operations", () => {
  it("adds a node and stores its layout position", () => {
    const draft = applyAgentAction(draftWithExample(), {
      type: "add_node",
      node: { name: "follow_up", task_messages: [{ role: "developer", content: "Follow up." }], edges: [] },
      position: { x: 520, y: 820 },
    })

    expect(draft.config.nodes.some((node) => node.name === "follow_up")).toBe(true)
    expect(draft.layout.follow_up).toEqual({ x: 520, y: 820 })
  })

  it("renames a node and updates initial and inbound references", () => {
    const draft = applyAgentAction(draftWithExample(), {
      type: "update_node",
      nodeName: "greeting",
      patch: { name: "welcome" },
    })

    expect(draft.config.initial_node).toBe("welcome")
    expect(draft.config.nodes[0].name).toBe("welcome")
    expect(draft.layout.welcome).toEqual({ x: 230, y: 40 })

    const renamedTarget = applyAgentAction(draftWithExample(), {
      type: "update_node",
      nodeName: "collect_details",
      patch: { name: "collect_patient_details" },
    })
    expect(renamedTarget.config.nodes[0].edges[0].target).toBe("collect_patient_details")
    expect(renamedTarget.layout.collect_patient_details).toEqual({ x: 230, y: 235 })
  })

  it("deletes a node and removes inbound transitions", () => {
    const draft = applyAgentAction(draftWithExample(), { type: "delete_node", nodeName: "offer_times" })

    expect(draft.config.nodes.some((node) => node.name === "offer_times")).toBe(false)
    expect(draft.config.nodes.flatMap((node) => node.edges).some((edge) => edge.target === "offer_times")).toBe(false)
    expect(draft.layout.offer_times).toBeUndefined()
  })

  it("protects the initial node from deletion", () => {
    const draft = applyAgentAction(draftWithExample(), { type: "delete_node", nodeName: "greeting" })

    expect(draft.config.nodes).toHaveLength(exampleAgent.nodes.length)
  })

  it("supports adding, editing, removing, and moving transitions", () => {
    let draft = draftWithExample()
    draft = applyAgentAction(draft, {
      type: "add_edge",
      source: "confirm",
      edge: { function: "restart", description: "Restart", target: "greeting", properties: {}, required: [] },
    })
    draft = applyAgentAction(draft, { type: "update_edge", source: "confirm", functionName: "restart", patch: { description: "Start over" } })
    expect(draft.config.nodes.find((node) => node.name === "confirm")?.edges[0].description).toBe("Start over")

    draft = applyAgentAction(draft, { type: "delete_edge", source: "confirm", functionName: "restart" })
    draft = applyAgentAction(draft, { type: "move_node", nodeName: "confirm", position: { x: 500, y: 900 } })
    expect(draft.config.nodes.find((node) => node.name === "confirm")?.edges).toHaveLength(0)
    expect(draft.layout.confirm).toEqual({ x: 500, y: 900 })
  })

  it("retargets an existing transition without changing its function", () => {
    const draft = applyAgentAction(draftWithExample(), {
      type: "update_edge",
      source: "greeting",
      functionName: "choose_intent",
      patch: { target: "confirm" },
    })

    expect(draft.config.nodes[0].edges[0]).toMatchObject({ function: "choose_intent", target: "confirm" })
  })
})
