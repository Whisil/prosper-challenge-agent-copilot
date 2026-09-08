import { supportedPropertyTypes, type AgentConfig, type AgentValidationError } from "../model/type"

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
      const functionName = edge.function.trim()
      if (!functionName) {
        errors.push({ path: `${edgePath}.function`, message: "Transition name cannot be empty.", severity: "error" })
      } else if (functions.has(functionName)) {
        errors.push({ path: `${edgePath}.function`, message: `Transition '${edge.function}' is duplicated on this node.`, severity: "error" })
      }
      functions.add(functionName)

      if (!edge.target.trim()) {
        errors.push({ path: `${edgePath}.target`, message: "Choose a next node.", severity: "error" })
      } else if (!config.nodes.some((candidate) => candidate.name === edge.target)) {
        errors.push({ path: `${edgePath}.target`, message: `Target node '${edge.target}' does not exist.`, severity: "error" })
      }

      if (!edge.description.trim()) {
        errors.push({ path: `${edgePath}.description`, message: "Explain when the model should use this transition.", severity: "error" })
      }

      const propertyNames = new Set<string>()
      Object.entries(edge.properties).forEach(([propertyName, property]) => {
        const propertyPath = `${edgePath}.properties.${propertyName || "unknown"}`
        if (!propertyName.trim()) {
          errors.push({ path: `${propertyPath}.name`, message: "Field name cannot be empty.", severity: "error" })
        } else if (propertyNames.has(propertyName)) {
          errors.push({ path: `${propertyPath}.name`, message: `Field '${propertyName}' is duplicated.`, severity: "error" })
        }
        propertyNames.add(propertyName)
        if (!supportedPropertyTypes.includes(property.type as typeof supportedPropertyTypes[number])) {
          errors.push({ path: `${propertyPath}.type`, message: "Choose a supported field type.", severity: "error" })
        }
        if (!property.description?.trim()) {
          errors.push({ path: `${propertyPath}.description`, message: "Describe what this field contains.", severity: "error" })
        }
      })

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
