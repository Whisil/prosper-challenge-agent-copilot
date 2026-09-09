import { validateAgentConfig } from "@/features/agent-graph/lib/validateAgent"
import type { AgentDraft, AgentDocument, AgentEdge, AgentNode, AgentValidationError } from "@/features/agent-graph/model/type"
import type { GraphOperation, OperationPreview, OperationResult } from "../model/type"

function cloneDocument(document: AgentDocument): AgentDocument {
  return JSON.parse(JSON.stringify(document)) as AgentDocument
}

function cloneDraft(draft: AgentDraft): AgentDraft {
  return { config: cloneDocument(draft.config), layout: JSON.parse(JSON.stringify(draft.layout)) as AgentDraft["layout"] }
}

function operationError(message: string, path = "proposal.operation"): AgentValidationError {
  return { path, message, severity: "error" }
}

function nodeById(document: AgentDocument, id: string) {
  return document.nodes.find((node) => (node.id ?? node.name) === id)
}

function nodeByName(document: AgentDocument, name: string) {
  return document.nodes.find((node) => node.name === name)
}

function edgeLocation(document: AgentDocument, edgeId: string): { source: AgentNode; edge: AgentEdge } | undefined {
  for (const source of document.nodes) {
    const edge = source.edges.find((candidate) => (candidate.id ?? `${source.name}-${candidate.function}`) === edgeId)
    if (edge) return { source, edge }
  }
  return undefined
}

export function validateGraphOperation(document: AgentDocument, operation: GraphOperation): AgentValidationError[] {
  switch (operation.op) {
    case "add_node": {
      const id = operation.node.id ?? ""
      if (!id.trim() || !operation.node.name.trim()) return [operationError("A proposed node needs a stable ID and runtime name.")]
      if (nodeById(document, id)) return [operationError(`Node ID '${id}' already exists.`)]
      if (nodeByName(document, operation.node.name)) return [operationError(`Node name '${operation.node.name}' already exists.`)]
      return []
    }
    case "update_node":
      if (!nodeById(document, operation.nodeId)) return [operationError(`Node '${operation.nodeId}' does not exist.`)]
      if (operation.patch.id !== undefined || operation.patch.name !== undefined) return [operationError("Proposals cannot rename stable runtime identifiers.")]
      return []
    case "remove_node":
      if (!nodeById(document, operation.nodeId)) return [operationError(`Node '${operation.nodeId}' does not exist.`)]
      if (nodeById(document, operation.nodeId)?.name === document.initial_node) return [operationError("The entry node cannot be deleted.")]
      return []
    case "add_edge": {
      const source = nodeById(document, operation.sourceNodeId)
      const target = nodeByName(document, operation.edge.target)
      if (!source) return [operationError(`Source node '${operation.sourceNodeId}' does not exist.`)]
      if (source.end || source.type === "end") return [operationError("End nodes cannot be transition sources.")]
      if (!target) return [operationError(`Target node '${operation.edge.target}' does not exist.`)]
      if (!operation.edge.id?.trim()) return [operationError("A proposed edge needs a stable ID.")]
      if (operation.edge.id && edgeLocation(document, operation.edge.id)) return [operationError(`Edge ID '${operation.edge.id}' already exists.`)]
      if (source.edges.some((edge) => edge.function === operation.edge.function)) return [operationError(`Transition '${operation.edge.function}' already exists on this node.`)]
      return []
    }
    case "update_edge": {
      const location = edgeLocation(document, operation.edgeId)
      if (!location) return [operationError(`Edge '${operation.edgeId}' does not exist.`)]
      if (operation.patch.id !== undefined || operation.patch.function !== undefined) return [operationError("Proposals cannot rename stable edge identifiers or runtime function names.")]
      if (operation.patch.target !== undefined && !nodeByName(document, operation.patch.target)) return [operationError(`Target node '${operation.patch.target}' does not exist.`)]
      return []
    }
    case "remove_edge":
      return edgeLocation(document, operation.edgeId) ? [] : [operationError(`Edge '${operation.edgeId}' does not exist.`)]
    case "update_agent":
      return typeof operation.patch.persona === "string" ? [] : [operationError("Agent persona must be text.")]
  }
}

export function applyGraphOperation(draft: AgentDraft, operation: GraphOperation): { draft?: AgentDraft; errors: AgentValidationError[] } {
  const errors = validateGraphOperation(draft.config, operation)
  if (errors.length > 0) return { errors }
  const next = cloneDraft(draft)

  switch (operation.op) {
    case "add_node": {
      const node = JSON.parse(JSON.stringify(operation.node)) as AgentNode
      node.id = node.id ?? node.name
      next.config.nodes.push(node)
      next.layout[node.name] = operation.position ?? { x: 120, y: 120 }
      break
    }
    case "update_node": {
      const node = nodeById(next.config, operation.nodeId)
      if (node) Object.assign(node, operation.patch)
      break
    }
    case "remove_node": {
      const removed = nodeById(next.config, operation.nodeId)
      next.config.nodes = next.config.nodes.filter((node) => (node.id ?? node.name) !== operation.nodeId)
      next.config.nodes.forEach((node) => { node.edges = node.edges.filter((edge) => edge.target !== removed?.name) })
      if (removed) delete next.layout[removed.name]
      break
    }
    case "add_edge": {
      const source = nodeById(next.config, operation.sourceNodeId)
      if (source) source.edges.push(JSON.parse(JSON.stringify(operation.edge)) as AgentEdge)
      break
    }
    case "update_edge": {
      const location = edgeLocation(next.config, operation.edgeId)
      if (location) Object.assign(location.edge, operation.patch)
      break
    }
    case "remove_edge":
      next.config.nodes.forEach((node) => { node.edges = node.edges.filter((edge) => (edge.id ?? `${node.name}-${edge.function}`) !== operation.edgeId) })
      break
    case "update_agent":
      next.config.persona = operation.patch.persona
      break
  }
  return { draft: next, errors: [] }
}

export function applyGraphOperations(draft: AgentDraft, operations: GraphOperation[], acceptedIndices = operations.map((_, index) => index)): OperationPreview {
  let current = cloneDraft(draft)
  const accepted = new Set(acceptedIndices)
  const results: OperationResult[] = []
  for (const [index, operation] of operations.entries()) {
    if (!accepted.has(index)) {
      results.push({ operation, index, accepted: false, errors: [] })
      continue
    }
    const result = applyGraphOperation(current, operation)
    results.push({ operation, index, accepted: result.errors.length === 0, errors: result.errors })
    if (result.draft) current = result.draft
  }
  const operationErrors = results.flatMap((result) => result.errors)
  const documentErrors = validateAgentConfig(current.config)
  return { document: current.config, layout: current.layout, results, errors: [...operationErrors, ...documentErrors] }
}
