import { describe, expect, it } from "vitest"
import { exampleAgent } from "@/features/agent-graph/data/exampleAgent"
import { runtimeConfigToDocument } from "@/features/agent-graph/lib/agentDocument"
import { createAgentDraft } from "@/features/agent-graph/lib/agentOperations"
import type { AgentNode } from "@/features/agent-graph/model/type"
import { applyGraphOperation, applyGraphOperations } from "./operationApplier"

const document = runtimeConfigToDocument(exampleAgent)

function node(id: string): AgentNode {
  return { id, name: id, title: id, type: "conversation", task_messages: [{ role: "developer", content: "Do the step." }], edges: [] }
}

describe("operationApplier", () => {
  it("applies stable-id operations immutably", () => {
    const draft = createAgentDraft(document)
    const result = applyGraphOperations(draft, [{ op: "add_node", node: node("verify_identity") }, { op: "update_agent", patch: { persona: "Be careful." } }])
    expect(result.document).not.toBe(document)
    expect(result.document.persona).toBe("Be careful.")
    expect(result.document.nodes.some((candidate) => candidate.id === "verify_identity")).toBe(true)
    expect(result.document.nodes.find((candidate) => candidate.id === document.initial_node)?.title).toBe(document.nodes[0].title)
  })

  it("rejects protected entry deletion and invalid references", () => {
    const draft = createAgentDraft(document)
    expect(applyGraphOperation(draft, { op: "remove_node", nodeId: document.initial_node }).errors[0].message).toContain("entry node")
    expect(applyGraphOperation(draft, { op: "update_edge", edgeId: "missing", patch: { target: "greeting" } }).errors).toHaveLength(1)
  })

  it("accepts complete outgoing edges on an added node", () => {
    const draft = createAgentDraft(document)
    const proposed = node("verify_identity")
    proposed.edges = [{ id: "identity_to_availability", function: "continue_booking", description: "Use after verification.", target: "offer_times", properties: {}, required: [], kind: "condition" }]

    const result = applyGraphOperation(draft, { op: "add_node", node: proposed })
    expect(result.errors).toHaveLength(0)
    expect(result.draft?.config.nodes.find((candidate) => candidate.id === "verify_identity")?.edges[0]?.id).toBe("identity_to_availability")
  })

  it("rejects the same edge when it is nested and added again", () => {
    const draft = createAgentDraft(document)
    const proposed = node("verify_identity")
    proposed.edges = [{ id: "identity_to_offer_times", function: "continue_booking", description: "Use after verification.", target: "offer_times", properties: {}, required: [], kind: "condition" }]
    const result = applyGraphOperations(draft, [
      { op: "add_node", node: proposed },
      { op: "add_edge", sourceNodeId: "verify_identity", edge: proposed.edges[0] },
    ])
    expect(result.errors.some((error) => error.message.includes("already exists"))).toBe(true)
  })

  it("inserts a node with one explicit add_edge operation", () => {
    const draft = createAgentDraft(document)
    const result = applyGraphOperations(draft, [
      { op: "add_node", node: node("verify_identity") },
      { op: "add_edge", sourceNodeId: "verify_identity", edge: { id: "identity_to_offer_times", function: "continue_after_verification", description: "Use after verification.", target: "offer_times", properties: {}, required: [], kind: "condition" } },
    ])

    expect(result.errors.filter((error) => error.severity === "error")).toHaveLength(0)
    expect(result.document.nodes.find((candidate) => candidate.id === "verify_identity")?.edges[0]?.id).toBe("identity_to_offer_times")
  })

  it("supports selective operation approval", () => {
    const draft = createAgentDraft(document)
    const result = applyGraphOperations(draft, [{ op: "update_agent", patch: { persona: "one" } }, { op: "update_agent", patch: { persona: "two" } }], [1])
    expect(result.document.persona).toBe("two")
    expect(result.results[0].accepted).toBe(false)
  })
})
