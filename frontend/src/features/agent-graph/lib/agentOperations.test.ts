import { describe, expect, it } from "vitest"
import { exampleAgent } from "../data/exampleAgent"
import { defaultNodePosition } from "./graphLayout"
import { applyAgentAction, createAgentDraft, createCanvasTransition, createDefaultAgentProperty, renameAgentProperty, setAgentPropertyRequired } from "./agentOperations"
import { runtimeConfigToDocument } from "./agentDocument"
import { validateAgentConfig } from "./validateAgent"

function draftWithExample() {
  return createAgentDraft(exampleAgent)
}

describe("agent operations", () => {
  it("adds a node and stores its layout position", () => {
    const draft = applyAgentAction(draftWithExample(), {
      type: "add_node",
      node: { name: "follow_up", task_messages: [{ role: "developer", content: "Follow up." }], edges: [], end: false },
      position: { x: 520, y: 820 },
    })

    expect(draft.config.nodes.some((node) => node.name === "follow_up")).toBe(true)
    expect(draft.layout.follow_up).toEqual({ x: 520, y: 820 })
    expect(draft.config.nodes.find((node) => node.name === "follow_up")?.end).toBe(false)
  })

  it("supports a separate terminal node creation action", () => {
    const draft = applyAgentAction(draftWithExample(), {
      type: "add_node",
      node: { name: "goodbye", task_messages: [{ role: "developer", content: "Say goodbye." }], edges: [], end: true },
      position: { x: 520, y: 820 },
    })

    expect(draft.config.nodes.find((node) => node.name === "goodbye")?.end).toBe(true)
  })

  it("edits a display title without changing stable node references", () => {
    const draft = applyAgentAction(draftWithExample(), {
      type: "update_node",
      nodeName: "greeting",
      patch: { title: "Welcome caller" },
    })

    expect(draft.config.initial_node).toBe("greeting")
    expect(draft.config.nodes[0]).toMatchObject({ name: "greeting", id: "greeting", title: "Welcome caller" })
    expect(draft.layout.greeting).toEqual({ x: 230, y: 40 })

    const updatedTarget = applyAgentAction(draftWithExample(), {
      type: "update_node",
      nodeName: "collect_details",
      patch: { title: "Collect patient details" },
    })
    expect(updatedTarget.config.nodes[0].edges[0].target).toBe("collect_details")
    expect(updatedTarget.layout.collect_details).toEqual({ x: 230, y: 420 })
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

  it("allows terminal nodes to be deleted and removes inbound transitions", () => {
    const draft = applyAgentAction(draftWithExample(), { type: "delete_node", nodeName: "confirm" })

    expect(draft.config.nodes.some((node) => node.name === "confirm")).toBe(false)
    expect(draft.config.nodes.flatMap((node) => node.edges).some((edge) => edge.target === "confirm")).toBe(false)
  })

  it("removes deleted nodes from the config and validation surface", () => {
    const draft = applyAgentAction(draftWithExample(), { type: "delete_node", nodeName: "offer_times" })

    expect(draft.config.nodes.some((node) => node.name === "offer_times")).toBe(false)
    expect(draft.layout.offer_times).toBeUndefined()
    expect(validateAgentConfig(draft.config).some((error) => error.path.includes("offer_times"))).toBe(false)
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

  it("creates unique canvas transitions and rejects terminal or self connections", () => {
    const source = exampleAgent.nodes.find((node) => node.name === "greeting")
    const target = exampleAgent.nodes.find((node) => node.name === "confirm")
    const edge = createCanvasTransition(source, target)

    expect(edge).toMatchObject({ function: "new_transition_2", target: "confirm", description: "", properties: {}, required: [] })
    expect(createCanvasTransition(exampleAgent.nodes.find((node) => node.name === "confirm"), source)).toBeUndefined()
    expect(createCanvasTransition(source, source)).toBeUndefined()
  })

  it("uses the shared spacing rule for newly created node positions", () => {
    expect(defaultNodePosition(exampleAgent.nodes.length)).toEqual({ x: 230, y: 1560 })
  })

  it("updates the global persona without changing node data", () => {
    const draft = applyAgentAction(draftWithExample(), { type: "update_agent", patch: { persona: "Be concise." } })

    expect(draft.config.persona).toBe("Be concise.")
    expect(draft.config.nodes).toEqual(runtimeConfigToDocument(exampleAgent).nodes)
  })

  it("creates simple string fields and keeps required state aligned when renamed", () => {
    const edge = { function: "collect", description: "Collect details.", target: "confirm", properties: { name: createDefaultAgentProperty() }, required: [] }
    const requiredEdge = setAgentPropertyRequired(edge, "name", true)
    const renamedEdge = renameAgentProperty(requiredEdge, "name", "full_name")

    expect(createDefaultAgentProperty()).toEqual({ type: "string", description: "" })
    expect(renamedEdge?.properties.full_name).toEqual({ type: "string", description: "" })
    expect(renamedEdge?.required).toEqual(["full_name"])
  })
})
