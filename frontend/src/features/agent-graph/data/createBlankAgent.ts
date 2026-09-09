import type { AgentConfig } from "../model/type"

export function createBlankAgent(name: string, persona: string): AgentConfig {
  const safeName = name.trim() || "New Agent"
  const nodeName = "greeting"
  return {
    name: safeName,
    voice_id: "21m00Tcm4TlvDq8ikWAM",
    model: "gpt-4o",
    persona: persona.trim() || "You are a helpful voice assistant. Keep responses concise and guide the caller to the next step.",
    initial_node: nodeName,
    nodes: [{
      name: nodeName,
      task_messages: [{ role: "developer", content: "Welcome the caller and understand what they need help with." }],
      edges: [],
    }],
  }
}
