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

    expect(messages).toContain("Initial node 'Missing' does not exist.")
    expect(messages).toContain("Target node 'Missing Target' does not exist.")
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

    expect(messages).toContain("Node name 'Same' is duplicated.")
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

    expect(messages).toContain("Required field 'Intent' needs a matching property.")
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

  it("accepts existing backend property types for compatibility", () => {
    const config = configWith({
      nodes: exampleAgent.nodes.map((node) => node.name === "greeting" ? {
        ...node,
        edges: node.edges.map((edge) => ({
          ...edge,
          properties: {
            count: { type: "number", description: "A numeric count." },
            whole: { type: "integer", description: "A whole number." },
            confirmed: { type: "boolean", description: "Whether it is confirmed." },
          },
          required: ["count", "whole", "confirmed"],
        })),
      } : node),
    })

    expect(validateAgentConfig(config).filter((error) => error.severity === "error")).toEqual([])
  })

  it("includes structured locations for node, transition, and property errors", () => {
    const config = configWith({
      nodes: exampleAgent.nodes.map((node) => node.name === "greeting" ? {
        ...node,
        task_messages: [{ role: "developer", content: "" }],
        edges: node.edges.map((edge) => ({
          ...edge,
          description: "",
          properties: { intent: { type: "unsupported", description: "" } },
        })),
      } : node),
    })
    const errors = validateAgentConfig(config)

    expect(errors.find((error) => error.path.endsWith("task_messages"))?.location).toEqual({ nodeName: "greeting", field: "task_messages" })
    expect(errors.find((error) => error.path.endsWith("description") && error.location?.edgeFunction)?.location).toEqual({ nodeName: "greeting", edgeFunction: "choose_intent", field: "description" })
    expect(errors.find((error) => error.path.endsWith(".type"))?.location).toEqual({ nodeName: "greeting", edgeFunction: "choose_intent", propertyName: "intent", field: "type" })
  })

  it("detects duplicate stable IDs and cycles without an exit", () => {
    const config = configWith({
      nodes: [
        { ...exampleAgent.nodes[0], id: "same", name: "first", edges: [{ ...exampleAgent.nodes[0].edges[0], target: "second" }] },
        { ...exampleAgent.nodes[1], id: "same", name: "second", edges: [{ ...exampleAgent.nodes[1].edges[0], target: "first" }] },
      ],
      initial_node: "first",
    })
    const errors = validateAgentConfig(config)

    expect(errors.some((error) => error.path.endsWith(".id"))).toBe(true)
    expect(errors.some((error) => error.message.includes("cycle"))).toBe(true)
  })

  it("treats transfers as terminal nodes", () => {
    const config = configWith({
      nodes: [
        { ...exampleAgent.nodes[0], edges: [{ ...exampleAgent.nodes[0].edges[0], target: "handoff", kind: "condition", description: "Human request route." }] },
        { name: "handoff", id: "handoff", title: "Handoff", type: "transfer", end: true, task_messages: [{ role: "developer", content: "Internal handoff instruction." }], transfer: { reason: "Caller asked for staff." }, edges: [] },
      ],
      initial_node: "greeting",
    })
    expect(validateAgentConfig(config).filter((error) => error.severity === "error")).toEqual([])
  })
})
