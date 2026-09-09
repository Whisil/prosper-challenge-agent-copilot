import type { AgentConfig } from "../model/type"
import { exampleAgent } from "./exampleAgent"

export interface AgentTemplate {
  id: "scheduler" | "intake"
  name: string
  description: string
  config: AgentConfig
}

const intakeAgent: AgentConfig = {
  name: "Patient Intake",
  voice_id: exampleAgent.voice_id,
  model: exampleAgent.model,
  persona: "You are a calm patient-intake assistant. Ask one question at a time and escalate uncertainty to staff.",
  initial_node: "welcome",
  nodes: [
    { name: "welcome", task_messages: [{ role: "developer", content: "Welcome the caller and explain that you will collect basic information for the clinic." }], edges: [{ function: "collect_information", description: "Use when the caller is ready to provide their basic information.", target: "collect_information", properties: {}, required: [] }] },
    { name: "collect_information", task_messages: [{ role: "developer", content: "Collect the caller's name, date of birth, and reason for contacting the clinic. Ask one question at a time." }], edges: [{ function: "finish_intake", description: "Use when the required intake information has been collected.", target: "complete", properties: {}, required: [] }] },
    { name: "complete", task_messages: [{ role: "developer", content: "Summarize what was collected and explain that clinic staff will handle the next step." }], edges: [], end: true },
  ],
}

export const agentTemplates: AgentTemplate[] = [
  { id: "scheduler", name: "Clinic Scheduler", description: "Start with a tested appointment scheduling flow.", config: { ...exampleAgent, name: "Clinic Scheduler" } },
  { id: "intake", name: "Patient Intake", description: "Collect basic caller information and hand off the next step.", config: intakeAgent },
]

export function getAgentTemplate(id: AgentTemplate["id"]): AgentTemplate {
  return agentTemplates.find((template) => template.id === id) ?? agentTemplates[0]
}
