import type { AgentConfig } from "../model/type"

export const exampleAgent: AgentConfig = {
  name: "Prosper Scheduler",
  voice_id: "21m00Tcm4TlvDq8ikWAM",
  model: "gpt-4o",
  persona:
    "You are a warm, efficient scheduling assistant for a healthcare clinic. Keep replies to one or two short sentences and always use an available function to move the conversation forward.",
  initial_node: "greeting",
  nodes: [
    {
      name: "greeting",
      task_messages: [
        {
          role: "developer",
          content: "Greet the caller, introduce yourself as the clinic's scheduling assistant, and ask whether they would like to book, reschedule, or cancel an appointment.",
        },
      ],
      edges: [
        {
          function: "choose_intent",
          description: "Record what the caller wants to do once they say it.",
          target: "collect_details",
          properties: { intent: { type: "string", description: "The appointment action the caller wants to take.", enum: ["book", "reschedule", "cancel"] } },
          required: ["intent"],
        },
      ],
    },
    {
      name: "collect_details",
      task_messages: [
        {
          role: "developer",
          content: "Collect the caller's full name and the reason for the visit. Ask for whatever is still missing, one question at a time.",
        },
      ],
      edges: [
        {
          function: "record_details",
          description: "Record the caller's name and reason once both are known.",
          target: "offer_times",
          properties: {
            full_name: { type: "string", description: "The caller's full name." },
            reason: { type: "string", description: "The reason for the visit." },
          },
          required: ["full_name", "reason"],
        },
      ],
    },
    {
      name: "offer_times",
      task_messages: [
        {
          role: "developer",
          content: "Offer exactly two options: Tuesday at 10 AM, or Thursday at 2 PM. Ask which one works for them.",
        },
      ],
      edges: [
        {
          function: "select_time",
          description: "Record the slot the caller picks.",
          target: "confirm",
          properties: { slot: { type: "string", description: "The appointment slot selected by the caller.", enum: ["Tuesday 10 AM", "Thursday 2 PM"] } },
          required: ["slot"],
        },
      ],
    },
    {
      name: "confirm",
      task_messages: [
        {
          role: "developer",
          content: "Confirm the appointment, thank the caller, and say goodbye.",
        },
      ],
      edges: [],
      end: true,
    },
  ],
}
