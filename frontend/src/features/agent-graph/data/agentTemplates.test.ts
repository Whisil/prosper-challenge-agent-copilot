import { describe, expect, it } from "vitest"
import { createAgentDraft } from "../lib/agentOperations"
import { validateAgentConfig } from "../lib/validateAgent"
import { agentTemplates } from "./agentTemplates"

describe("agent templates", () => {
  it("provides valid starting documents", () => {
    expect(agentTemplates.map((template) => template.id)).toEqual(["scheduler", "intake", "test"])
    for (const template of agentTemplates) {
      const draft = createAgentDraft(template.config)
      expect(draft.config.nodes.length).toBeGreaterThan(0)
      expect(validateAgentConfig(draft.config).filter((error) => error.severity === "error")).toHaveLength(0)
    }
    const showcaseTemplate = agentTemplates.find((template) => template.id === "test")
    expect(showcaseTemplate?.name).toBe("Prosper Flow Test Agent")
    expect(showcaseTemplate?.config.nodes.length).toBeGreaterThan(10)
    expect(new Set(showcaseTemplate?.config.nodes.map((node) => node.type))).toEqual(new Set(["conversation", "tool", "transfer", "end"]))
    expect(showcaseTemplate?.config.nodes.some((node) => node.task_messages.some((message) => message.content.includes("Warning:")))).toBe(true)
    expect(showcaseTemplate?.config.nodes.some((node) => node.task_messages.some((message) => message.content.includes("Error:")))).toBe(true)
    expect(showcaseTemplate?.config.nodes.find((node) => node.name === "check_availability")?.edges.map((edge) => edge.kind)).toEqual(expect.arrayContaining(["success", "failure"]))
    expect(showcaseTemplate?.config.nodes.filter((node) => node.type === "transfer").every((node) => node.end && node.edges.length === 0)).toBe(true)
  })
})
