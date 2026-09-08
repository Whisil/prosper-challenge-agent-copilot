import { describe, expect, it } from "vitest"
import type { AgentValidationError } from "../model/type"
import { groupValidationErrors, validationErrorsForNode, validationLocationLabel } from "./validationPresentation"

const errors: AgentValidationError[] = [
  { path: "nodes.greeting.task_messages", message: "Add an instruction.", severity: "error", location: { nodeName: "greeting", field: "task_messages" } },
  { path: "nodes.offer_times.edges", message: "No outgoing transition.", severity: "warning", location: { nodeName: "offer_times", field: "edges" } },
  { path: "nodes.greeting.edges.choose_intent.description", message: "Add a description.", severity: "error", location: { nodeName: "greeting", edgeFunction: "choose_intent", field: "description" } },
]

describe("validation presentation", () => {
  it("groups blocking errors and warnings", () => {
    expect(groupValidationErrors(errors)).toMatchObject({ errors: [errors[0], errors[2]], warnings: [errors[1]] })
  })

  it("finds all issues belonging to a node", () => {
    expect(validationErrorsForNode(errors, "greeting")).toHaveLength(2)
  })

  it("formats a human-readable validation location", () => {
    expect(validationLocationLabel(errors[2])).toBe("Greeting → Choose Intent → Description")
  })
})
