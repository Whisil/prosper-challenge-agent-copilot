import { describe, expect, it } from "vitest"
import { createAgentDraft } from "../lib/agentOperations"
import { validateAgentConfig } from "../lib/validateAgent"
import { agentTemplates } from "./agentTemplates"

describe("agent templates", () => {
  it("provides valid scheduler and intake starting documents", () => {
    expect(agentTemplates.map((template) => template.id)).toEqual(["scheduler", "intake"])
    for (const template of agentTemplates) {
      const draft = createAgentDraft(template.config)
      expect(draft.config.nodes.length).toBeGreaterThan(0)
      expect(validateAgentConfig(draft.config).filter((error) => error.severity === "error")).toHaveLength(0)
    }
  })
})
