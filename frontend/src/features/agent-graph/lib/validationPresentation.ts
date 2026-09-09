import type { AgentValidationError } from "../model/type"
import { humanizeIdentifier } from "./identifier"

const fieldLabels: Record<string, string> = {
  name: "Name",
  task_messages: "Task instruction",
  edges: "Transitions",
  function: "Transition name",
  target: "Next node",
  description: "Description",
  type: "Field type",
  required: "Required fields",
  id: "Stable ID",
  tool: "Tool setup",
  confirmationRequired: "Confirmation",
  transfer: "Handoff reason",
  exit: "Exit path",
  initial_node: "Entry point",
}

export function validationErrorsForNode(errors: AgentValidationError[], nodeName: string) {
  return errors.filter((error) => error.location?.nodeName === nodeName || error.path.startsWith(`nodes.${nodeName}`))
}

export function validationLocationLabel(error: AgentValidationError) {
  const location = error.location
  if (!location) return "Agent configuration"

  const labels = [location.nodeName, location.edgeFunction, location.propertyName]
    .filter(Boolean)
    .map((value) => humanizeIdentifier(value as string))

  if (location.field) labels.push(fieldLabels[location.field] ?? location.field)
  return labels.length > 0 ? labels.join(" → ") : "Agent configuration"
}

export function groupValidationErrors(errors: AgentValidationError[]) {
  return {
    errors: errors.filter((error) => error.severity === "error"),
    warnings: errors.filter((error) => error.severity === "warning"),
  }
}
