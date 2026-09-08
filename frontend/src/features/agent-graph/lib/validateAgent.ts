import { agentEdgeKinds, agentNodeTypes, supportedPropertyTypes, type AgentConfig, type AgentValidationError } from "../model/type"
import { humanizeIdentifier } from "./identifier"

export function validateAgentConfig(config: AgentConfig): AgentValidationError[] {
  const errors: AgentValidationError[] = []
  const names = new Set<string>()
  const nodeIds = new Set<string>()
  const edgeIds = new Set<string>()
  const requiresDocumentFields = "version" in config

  if (config.nodes.length === 0) {
    errors.push({ path: "nodes", message: "Add at least one node.", severity: "error" })
  }

  config.nodes.forEach((node, nodeIndex) => {
    const rawNodeId = node.id ?? node.name
    const nodeId = typeof rawNodeId === "string" ? rawNodeId : ""
    const nodePath = `nodes.${nodeId || nodeIndex}`
    if (!nodeId.trim()) {
      errors.push({ path: `${nodePath}.id`, message: "Stable node ID cannot be empty.", severity: "error", location: { nodeName: node.name, field: "id" } })
    } else if (nodeIds.has(nodeId)) {
      errors.push({ path: `${nodePath}.id`, message: `Stable node ID '${humanizeIdentifier(nodeId)}' is duplicated.`, severity: "error", location: { nodeName: node.name, field: "id" } })
    }
    nodeIds.add(nodeId)
    const trimmedName = typeof node.name === "string" ? node.name.trim() : ""
    if (!trimmedName) {
      errors.push({ path: `${nodePath}.name`, message: "Node name cannot be empty.", severity: "error", location: { nodeName: node.name || undefined, field: "name" } })
    } else if (names.has(trimmedName)) {
      errors.push({ path: `${nodePath}.name`, message: `Node name '${humanizeIdentifier(trimmedName)}' is duplicated.`, severity: "error", location: { nodeName: node.name, field: "name" } })
    }
    names.add(trimmedName)

    if (requiresDocumentFields && !node.title?.trim()) {
      errors.push({ path: `${nodePath}.title`, message: "Add a display title for this node.", severity: "error", location: { nodeName: node.name, field: "title" } })
    }

    const nodeType = node.type ?? (node.end ? "end" : "conversation")
    if (requiresDocumentFields && !agentNodeTypes.includes(nodeType as typeof agentNodeTypes[number])) {
      errors.push({ path: `${nodePath}.type`, message: "Choose a supported node type.", severity: "error", location: { nodeName: node.name, field: "type" } })
    }

    if (!node.task_messages[0]?.content.trim()) {
      errors.push({ path: `${nodePath}.task_messages`, message: "Add an instruction for this node.", severity: "error", location: { nodeName: node.name, field: "task_messages" } })
    }

    if (!node.end && node.edges.length === 0) {
      errors.push({ path: `${nodePath}.edges`, message: "This non-terminal node has no outgoing transition.", severity: "warning", location: { nodeName: node.name, field: "edges" } })
    }

    if (nodeType === "end" && node.edges.length > 0) {
      errors.push({ path: `${nodePath}.edges`, message: "End nodes cannot have outgoing transitions.", severity: "error", location: { nodeName: node.name, field: "edges" } })
    }
    if (nodeType === "tool" && (!node.tool || typeof node.tool.name !== "string" || typeof node.tool.description !== "string" || !node.tool.name.trim() || !node.tool.description.trim())) {
      errors.push({ path: `${nodePath}.tool`, message: "Tool nodes need a name and description.", severity: "error", location: { nodeName: node.name, field: "tool" } })
    }
    if (nodeType === "tool" && node.tool?.confirmationRequired === undefined) {
      errors.push({ path: `${nodePath}.tool.confirmationRequired`, message: "Choose whether this tool requires confirmation before an action.", severity: "error", location: { nodeName: node.name, field: "confirmationRequired" } })
    }
    if (nodeType === "branch" && (typeof node.branch?.expression !== "string" || !node.branch.expression.trim())) {
      errors.push({ path: `${nodePath}.branch`, message: "Branch nodes need an expression.", severity: "error", location: { nodeName: node.name, field: "branch" } })
    }
    if (nodeType === "transfer" && (typeof node.transfer?.reason !== "string" || !node.transfer.reason.trim())) {
      errors.push({ path: `${nodePath}.transfer`, message: "Transfer nodes need a handoff reason.", severity: "error", location: { nodeName: node.name, field: "transfer" } })
    }

    const functions = new Set<string>()
    node.edges.forEach((edge, edgeIndex) => {
      const edgePath = `${nodePath}.edges.${edge.function || edgeIndex}`
      const edgeId = edge.id ?? `${node.name}-${edge.function || edgeIndex}`
      if (edgeIds.has(edgeId)) {
        errors.push({ path: `${edgePath}.id`, message: `Edge ID '${edgeId}' is duplicated.`, severity: "error", location: { nodeName: node.name, edgeFunction: edge.function, field: "id" } })
      }
      edgeIds.add(edgeId)
      const functionName = edge.function.trim()
      if (!functionName) {
        errors.push({ path: `${edgePath}.function`, message: "Transition name cannot be empty.", severity: "error", location: { nodeName: node.name, edgeFunction: edge.function, field: "function" } })
      } else if (functions.has(functionName)) {
        errors.push({ path: `${edgePath}.function`, message: `Transition '${humanizeIdentifier(edge.function)}' is duplicated on this node.`, severity: "error", location: { nodeName: node.name, edgeFunction: edge.function, field: "function" } })
      }
      functions.add(functionName)

      if (edge.kind && !agentEdgeKinds.includes(edge.kind as typeof agentEdgeKinds[number])) {
        errors.push({ path: `${edgePath}.kind`, message: "Choose a supported transition kind.", severity: "error", location: { nodeName: node.name, edgeFunction: edge.function, field: "kind" } })
      }

      if (!edge.target.trim()) {
        errors.push({ path: `${edgePath}.target`, message: "Choose a next node.", severity: "error", location: { nodeName: node.name, edgeFunction: edge.function, field: "target" } })
      } else if (!config.nodes.some((candidate) => candidate.name === edge.target)) {
        errors.push({ path: `${edgePath}.target`, message: `Target node '${humanizeIdentifier(edge.target)}' does not exist.`, severity: "error", location: { nodeName: node.name, edgeFunction: edge.function, field: "target" } })
      }

      if (!edge.description.trim()) {
        errors.push({ path: `${edgePath}.description`, message: "Explain when the model should use this transition.", severity: "error", location: { nodeName: node.name, edgeFunction: edge.function, field: "description" } })
      }

      const propertyNames = new Set<string>()
      Object.entries(edge.properties).forEach(([propertyName, property]) => {
        const propertyPath = `${edgePath}.properties.${propertyName || "unknown"}`
        if (!propertyName.trim()) {
          errors.push({ path: `${propertyPath}.name`, message: "Field name cannot be empty.", severity: "error", location: { nodeName: node.name, edgeFunction: edge.function, propertyName, field: "name" } })
        } else if (propertyNames.has(propertyName)) {
          errors.push({ path: `${propertyPath}.name`, message: `Field '${humanizeIdentifier(propertyName)}' is duplicated.`, severity: "error", location: { nodeName: node.name, edgeFunction: edge.function, propertyName, field: "name" } })
        }
        propertyNames.add(propertyName)
        if (!supportedPropertyTypes.includes(property.type as typeof supportedPropertyTypes[number])) {
          errors.push({ path: `${propertyPath}.type`, message: "Choose a supported field type.", severity: "error", location: { nodeName: node.name, edgeFunction: edge.function, propertyName, field: "type" } })
        }
        if (!property.description?.trim()) {
          errors.push({ path: `${propertyPath}.description`, message: "Describe what this field contains.", severity: "error", location: { nodeName: node.name, edgeFunction: edge.function, propertyName, field: "description" } })
        }
      })

      edge.required.forEach((requiredProperty) => {
        if (!edge.properties[requiredProperty]) {
          errors.push({ path: `${edgePath}.required`, message: `Required field '${humanizeIdentifier(requiredProperty)}' needs a matching property.`, severity: "error", location: { nodeName: node.name, edgeFunction: edge.function, propertyName: requiredProperty, field: "required" } })
        }
      })
    })
    if (node.edges.filter((edge) => (edge.kind ?? "condition") === "default").length > 1) {
      errors.push({ path: `${nodePath}.edges.default`, message: "A node can have only one default fallback transition.", severity: "error", location: { nodeName: node.name, field: "edges" } })
    }
  })

  if (!config.nodes.some((node) => node.name === config.initial_node)) {
    errors.push({ path: "initial_node", message: `Initial node '${humanizeIdentifier(config.initial_node)}' does not exist.`, severity: "error", location: { field: "initial_node" } })
  }

  const reachable = new Set<string>()
  const queue = config.nodes.some((node) => node.name === config.initial_node) ? [config.initial_node] : []
  while (queue.length > 0) {
    const nodeName = queue.shift() as string
    if (reachable.has(nodeName)) continue
    reachable.add(nodeName)
    const node = config.nodes.find((candidate) => candidate.name === nodeName)
    node?.edges.forEach((edge) => {
      if (config.nodes.some((candidate) => candidate.name === edge.target)) queue.push(edge.target)
    })
  }
  config.nodes.forEach((node) => {
    if (!reachable.has(node.name)) {
      errors.push({ path: `nodes.${node.name}.reachable`, message: "This node cannot be reached from the entry point.", severity: "warning", location: { nodeName: node.name, field: "reachable" } })
    }
  })

  const canReachEnd = (nodeName: string, visiting = new Set<string>(), memo = new Map<string, boolean>()): boolean => {
    if (memo.has(nodeName)) return memo.get(nodeName) as boolean
    if (visiting.has(nodeName)) return false
    const node = config.nodes.find((candidate) => candidate.name === nodeName)
    if (!node) return false
    if (node.end || node.type === "end") return true
    const nextVisiting = new Set(visiting).add(nodeName)
    const result = node.edges.some((edge) => canReachEnd(edge.target, nextVisiting, memo))
    memo.set(nodeName, result)
    return result
  }
  config.nodes.forEach((node) => {
    if (!node.end && node.edges.length > 0 && !canReachEnd(node.name)) {
      errors.push({ path: `nodes.${node.name}.exit`, message: "This node is in a cycle with no reachable end node.", severity: "error", location: { nodeName: node.name, field: "exit" } })
    }
  })

  config.nodes.filter((node) => node.type === "branch").forEach((node) => {
    if (!node.edges.some((edge) => (edge.kind ?? "condition") === "default")) {
      errors.push({ path: `nodes.${node.name}.fallback`, message: "Add a default fallback transition for this branch.", severity: "warning", location: { nodeName: node.name, field: "fallback" } })
    }
  })

  return errors
}
