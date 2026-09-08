import type { AgentConfig, AgentValidationError } from "../model/type"

export function validateAgentConfig(config: AgentConfig): AgentValidationError[] {
  const errors: AgentValidationError[] = []
  const names = new Set<string>()

  if (config.nodes.length === 0) {
    errors.push({ path: "nodes", message: "Add at least one conversation node.", severity: "error" })
  }

  config.nodes.forEach((node, nodeIndex) => {
    const nodePath = `nodes.${node.name || nodeIndex}`
    const trimmedName = node.name.trim()
    if (!trimmedName) {
      errors.push({ path: `${nodePath}.name`, message: "Node name cannot be empty.", severity: "error" })
    } else if (names.has(trimmedName)) {
      errors.push({ path: `${nodePath}.name`, message: `Node name '${trimmedName}' is duplicated.`, severity: "error" })
    }
    names.add(trimmedName)

    if (!node.task_messages[0]?.content.trim()) {
      errors.push({ path: `${nodePath}.task_messages`, message: "Add an instruction for this node.", severity: "error" })
    }

    if (!node.end && node.edges.length === 0) {
      errors.push({ path: `${nodePath}.edges`, message: "This non-terminal node has no outgoing transition.", severity: "warning" })
    }

    const functions = new Set<string>()
    node.edges.forEach((edge, edgeIndex) => {
      const edgePath = `${nodePath}.edges.${edge.function || edgeIndex}`
      if (functions.has(edge.function)) {
        errors.push({ path: `${edgePath}.function`, message: `Transition '${edge.function}' is duplicated on this node.`, severity: "error" })
      }
      functions.add(edge.function)

      if (!config.nodes.some((candidate) => candidate.name === edge.target)) {
        errors.push({ path: `${edgePath}.target`, message: `Target node '${edge.target}' does not exist.`, severity: "error" })
      }

      edge.required.forEach((requiredProperty) => {
        if (!edge.properties[requiredProperty]) {
          errors.push({ path: `${edgePath}.required`, message: `Required field '${requiredProperty}' needs a matching property.`, severity: "error" })
        }
      })
    })
  })

  if (!config.nodes.some((node) => node.name === config.initial_node)) {
    errors.push({ path: "initial_node", message: `Initial node '${config.initial_node}' does not exist.`, severity: "error" })
  }

  return errors
}
