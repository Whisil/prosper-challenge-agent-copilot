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

  it("supports selective operation approval", () => {
    const draft = createAgentDraft(document)
    const result = applyGraphOperations(draft, [{ op: "update_agent", patch: { persona: "one" } }, { op: "update_agent", patch: { persona: "two" } }], [1])
    expect(result.document.persona).toBe("two")
    expect(result.results[0].accepted).toBe(false)
  })
})
