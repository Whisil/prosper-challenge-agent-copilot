import { describe, expect, it } from "vitest"
import { createAgentDraft } from "../lib/agentOperations"
import { validateAgentConfig } from "../lib/validateAgent"
import { createBlankAgent } from "./createBlankAgent"

describe("createBlankAgent", () => {
  it("creates a valid single-node starting draft", () => {
    const draft = createAgentDraft(createBlankAgent("Front desk", "Be concise."))

    expect(draft.config.name).toBe("Front desk")
    expect(draft.config.initial_node).toBe("greeting")
    expect(draft.config.nodes).toHaveLength(1)
    expect(draft.config.nodes[0].id).toBe("greeting")
    expect(draft.config.nodes[0].type).toBe("conversation")
    expect(draft.config.nodes[0].edges).toHaveLength(0)
    expect(validateAgentConfig(draft.config).filter((error) => error.severity === "error")).toHaveLength(0)
  })
})
