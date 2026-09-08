import { describe, expect, it } from "vitest"
import { exampleAgent } from "../data/exampleAgent"
import type { AgentConfig } from "../model/type"
import { validateAgentConfig } from "./validateAgent"

function configWith(patch: Partial<AgentConfig>): AgentConfig {
  return { ...exampleAgent, ...patch }
}

describe("validateAgentConfig", () => {
  it("accepts the example agent", () => {
    expect(validateAgentConfig(exampleAgent)).toEqual([])
  })

  it("detects invalid initial nodes and missing edge targets", () => {
    const config = configWith({ initial_node: "missing", nodes: exampleAgent.nodes.map((node) => ({ ...node, edges: node.edges.map((edge) => edge.target === "collect_details" ? { ...edge, target: "missing_target" } : edge) })) })
    const messages = validateAgentConfig(config).map((error) => error.message)

    expect(messages).toContain("Initial node 'missing' does not exist.")
    expect(messages).toContain("Target node 'missing_target' does not exist.")
  })

  it("detects duplicate names and empty instructions", () => {
    const config = configWith({
      nodes: [
        { ...exampleAgent.nodes[0], name: "same" },
        { ...exampleAgent.nodes[1], name: "same", task_messages: [{ role: "developer", content: "" }] },
      ],
      initial_node: "same",
    })
    const messages = validateAgentConfig(config).map((error) => error.message)

    expect(messages).toContain("Node name 'same' is duplicated.")
    expect(messages).toContain("Add an instruction for this node.")
  })

  it("requires properties for required transition fields", () => {
    const config = configWith({
      nodes: exampleAgent.nodes.map((node) => node.name === "greeting" ? {
        ...node,
        edges: node.edges.map((edge) => ({ ...edge, properties: {}, required: ["intent"] })),
      } : node),
    })
    const messages = validateAgentConfig(config).map((error) => error.message)

    expect(messages).toContain("Required field 'intent' needs a matching property.")
  })

  it("validates transition descriptions and property definitions", () => {
    const config = configWith({
      nodes: exampleAgent.nodes.map((node) => node.name === "greeting" ? {
        ...node,
        edges: node.edges.map((edge) => ({
          ...edge,
          description: "",
          properties: { intent: { type: "date", description: "" } },
        })),
      } : node),
    })
    const errors = validateAgentConfig(config)

    expect(errors.map((error) => error.path)).toEqual(expect.arrayContaining([
      "nodes.greeting.edges.choose_intent.description",
      "nodes.greeting.edges.choose_intent.properties.intent.type",
      "nodes.greeting.edges.choose_intent.properties.intent.description",
    ]))
  })

  it("accepts complete supported property definitions", () => {
    const errors = validateAgentConfig(exampleAgent)

    expect(errors.filter((error) => error.severity === "error")).toEqual([])
  })
})
