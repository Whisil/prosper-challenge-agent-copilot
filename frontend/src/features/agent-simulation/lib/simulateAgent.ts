import type { AgentDocument, AgentNode, TestSession, TraceEvent } from "../../agent-graph/model/type"

export const simulationScenarios = [
  { id: "normal-booking", label: "Normal booking", outcome: "Booking path completed." },
  { id: "verification-failure", label: "Verification failure", outcome: "Verification failed twice; transfer path recommended." },
  { id: "no-availability", label: "No availability", outcome: "No matching slot; fallback path recommended." },
  { id: "human-request", label: "Caller requests a human", outcome: "Conversation transferred to staff." },
  { id: "tool-failure", label: "Tool failure", outcome: "Tool failure surfaced for review." },
] as const

export type SimulationScenarioId = (typeof simulationScenarios)[number]["id"]

export function simulateAgent(document: AgentDocument, scenarioId: SimulationScenarioId): Pick<TestSession, "status" | "events"> {
  const initial = document.nodes.find((node) => node.name === document.initial_node)
  const now = new Date().toISOString()
  const events: TraceEvent[] = initial ? [{ timestamp: now, kind: "node_entered", nodeId: initial.id ?? initial.name, message: `Entered ${initial.title ?? initial.name}.` }] : []
  const scenario = simulationScenarios.find((item) => item.id === scenarioId)
  if (scenarioId === "normal-booking" && initial) {
    const edge = initial.edges[0]
    if (edge) events.push({ timestamp: now, kind: "transition", nodeId: initial.id ?? initial.name, edgeId: edge.id, message: `Followed ${edge.function}.` })
  }
  events.push({ timestamp: now, kind: scenarioId === "human-request" ? "handoff" : scenarioId === "tool-failure" ? "tool_call" : "ended", message: scenario?.outcome })
  return { status: scenarioId === "tool-failure" ? "failed" : "completed", events }
}

export function nodeTypeLabel(node: AgentNode) {
  return node.type === "end" || node.end ? "End" : node.type === "tool" ? "Tool" : node.type === "branch" ? "Branch" : node.type === "transfer" ? "Transfer" : "Conversation"
}
