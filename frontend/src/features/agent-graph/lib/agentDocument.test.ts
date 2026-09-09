import { describe, expect, it } from "vitest"
import { exampleAgent } from "../data/exampleAgent"
import { documentToDraft, documentToRuntimeConfig, parseAgentDocument, runtimeConfigToDocument } from "./agentDocument"
import type { AgentConfig } from "../model/type"

describe("agent document adapters", () => {
  it("migrates the legacy runtime contract into a versioned document", () => {
    const document = runtimeConfigToDocument(exampleAgent)

    expect(document.version).toBe(1)
    expect(document.id).toBe("prosper_scheduler")
    expect(document.nodes[0]).toMatchObject({ id: "greeting", title: "Greeting", type: "conversation" })
    expect(document.nodes.at(-1)).toMatchObject({ id: "confirm", title: "Confirm", type: "end" })
    expect(document.nodes[0].edges[0]).toMatchObject({ id: "greeting-choose_intent-1", kind: "condition" })
  })

  it("round-trips a document without leaking editor metadata into runtime config", () => {
    const document = runtimeConfigToDocument(exampleAgent)
    document.nodes[0].title = "Welcome caller"
    const runtime = documentToRuntimeConfig(document)

    expect(runtime.nodes[0]).not.toHaveProperty("title")
    expect(runtime.nodes[0]).not.toHaveProperty("id")
    expect(runtime.nodes[0].name).toBe("greeting")
    expect(runtime.nodes[0].edges[0]).not.toHaveProperty("kind")
  })

  it("accepts legacy JSON and normalizes it on import", () => {
    const imported = parseAgentDocument(exampleAgent)

    expect(imported.version).toBe(1)
    expect(imported.nodes.every((node) => node.id && node.title && node.type)).toBe(true)
  })

  it("keeps every generated node in a preview draft", () => {
    const document = runtimeConfigToDocument(exampleAgent)
    document.nodes.push({ id: "extra", name: "extra", title: "Extra", type: "conversation", task_messages: [{ role: "developer", content: "Handle the extra step." }], edges: [] })
    const draft = documentToDraft(document)
    expect(draft.config.nodes.map((node) => node.id)).toContain("extra")
    expect(draft.layout.extra).toEqual({ x: 230, y: 1560 })
  })

  it("removes legacy branch nodes and normalizes their graph metadata", () => {
    const migrated = runtimeConfigToDocument({ ...exampleAgent, initial_node: "legacy_branch", nodes: [
      { name: "legacy_branch", type: "branch" as never, branch: { expression: "caller wants help" } as never, task_messages: [{ role: "developer", content: "route" }], edges: [{ function: "old", description: "old", target: "greeting", kind: "default" as never, condition: "x" as never, properties: {}, required: [] }] },
      { ...exampleAgent.nodes[0], edges: [] },
    ] } as unknown as AgentConfig)

    expect(migrated.nodes.map((node) => node.name)).toEqual(["greeting"])
    expect(migrated.initial_node).toBe("greeting")
    expect(migrated.nodes[0].edges).toHaveLength(0)
  })
})
