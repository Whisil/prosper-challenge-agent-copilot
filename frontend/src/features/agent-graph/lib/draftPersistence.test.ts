import { describe, expect, it } from "vitest"
import { exampleAgent } from "../data/exampleAgent"
import { createAgentDraft } from "./agentOperations"
import { parseDraft, serializeDraft } from "./draftPersistence"
import { createDraftHistory, reduceDraftHistory } from "./history"

describe("draft persistence and history", () => {
  it("round-trips a draft with layout metadata", () => {
    const draft = createAgentDraft(exampleAgent)
    draft.layout.greeting = { x: 900, y: 140 }

    const restored = parseDraft(JSON.parse(serializeDraft(draft)))

    expect(restored.config.id).toBe("prosper_scheduler")
    expect(restored.layout.greeting).toEqual({ x: 900, y: 140 })
  })

  it("supports undo and redo of serializable editor actions", () => {
    const initial = createDraftHistory(createAgentDraft(exampleAgent))
    const changed = reduceDraftHistory(initial, { type: "apply", action: { type: "update_agent", patch: { persona: "Be concise." } } })
    const undone = reduceDraftHistory(changed, { type: "undo" })
    const redone = reduceDraftHistory(undone, { type: "redo" })

    expect(undone.present.config.persona).toBe(exampleAgent.persona)
    expect(redone.present.config.persona).toBe("Be concise.")
  })

})
