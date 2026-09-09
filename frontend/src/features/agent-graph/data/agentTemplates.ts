import type { AgentConfig } from "../model/type"
import { exampleAgent } from "./exampleAgent"

export interface AgentTemplate {
  id: "scheduler" | "intake" | "test"
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

export const showcaseAgent: AgentConfig = {
  name: "Prosper Flow Test Agent",
  voice_id: exampleAgent.voice_id,
  model: exampleAgent.model,
  persona: "You are a concise clinic assistant. Keep replies short and follow the configured routes.",
  initial_node: "caller_request",
  nodes: [
    {
      id: "caller_request", name: "caller_request", title: "Caller Request", type: "conversation",
      task_messages: [{ role: "developer", content: "Ask what the caller needs: book, reschedule, cancel, speak to staff, or report an urgent concern." }],
      edges: [
        { id: "request_to_availability", function: "book_appointment", description: "Use when the caller wants to book. This route intentionally demonstrates availability before verification.", target: "share_availability", properties: {}, required: [], kind: "condition" },
        { id: "request_to_reschedule", function: "reschedule_appointment", description: "Use when the caller wants to change an appointment.", target: "collect_details", properties: {}, required: [], kind: "condition" },
        { id: "request_to_cancel", function: "cancel_appointment", description: "Use when the caller wants to cancel an appointment.", target: "cancel_confirmation", properties: {}, required: [], kind: "condition" },
        { id: "request_to_human", function: "request_staff", description: "Use when the caller asks to speak with a person.", target: "staff_handoff", properties: {}, required: [], kind: "condition" },
        { id: "request_to_urgent", function: "urgent_request", description: "Use when the caller reports an urgent concern.", target: "urgent_handoff", properties: {}, required: [], kind: "condition" },
      ],
    },
    {
      id: "share_availability", name: "share_availability", title: "Share Availability", type: "conversation",
      task_messages: [{ role: "developer", content: "Offer two short appointment options. This test route intentionally demonstrates a missing verification guard." }],
      edges: [{ id: "availability_to_details", function: "continue_booking", description: "Use after the caller chooses an option and booking details are needed.", target: "collect_details", properties: { slot: { type: "string", description: "The appointment option the caller chose." } }, required: ["slot"], kind: "condition" }],
    },
    {
      id: "collect_details", name: "collect_details", title: "Collect Details", type: "conversation",
      task_messages: [{ role: "developer", content: "Collect the caller name, appointment reason, and preferred day. Ask one question at a time." }],
      edges: [{ id: "details_to_verification", function: "record_details", description: "Use when the required appointment details are complete.", target: "verify_identity", properties: { patient_name: { type: "string", description: "The caller's full name." }, appointment_reason: { type: "string", description: "The reason for the visit." }, preferred_day: { type: "string", description: "The caller's preferred appointment day." } }, required: ["patient_name", "appointment_reason"], kind: "condition" }],
    },
    {
      id: "verify_identity", name: "verify_identity", title: "Verify Identity", type: "conversation",
      task_messages: [{ role: "developer", content: "Verify the caller before protected scheduling details. If verification fails twice, use the warning route." }],
      edges: [
        { id: "verification_to_availability", function: "verification_passed", description: "Use after identity verification succeeds.", target: "check_availability", properties: {}, required: [], kind: "success" },
        { id: "verification_to_warning", function: "verification_failed", description: "Use after verification cannot be completed.", target: "verification_warning", properties: {}, required: [], kind: "failure" },
        { id: "verification_to_human", function: "verification_help", description: "Use when the caller needs staff help with verification.", target: "staff_handoff", properties: {}, required: [], kind: "condition" },
      ],
    },
    {
      id: "verification_warning", name: "verification_warning", title: "Verification Warning", type: "conversation",
      task_messages: [{ role: "developer", content: "Say exactly: \"Warning: I could not verify that information. I will connect you to staff.\"" }],
      edges: [{ id: "warning_to_verification_handoff", function: "send_to_staff", description: "Use after the verification warning is spoken.", target: "verification_handoff", properties: {}, required: [], kind: "condition" }],
    },
    {
      id: "check_availability", name: "check_availability", title: "Check Availability", type: "tool",
      task_messages: [{ role: "developer", content: "Check the mock schedule and report whether options are available." }],
      tool: { name: "check_availability", description: "Returns mock appointment availability.", confirmationRequired: false, mockResult: { available: true } },
      edges: [
        { id: "availability_found", function: "availability_found", description: "Use when appointment options are available.", target: "offer_times", properties: {}, required: [], kind: "success" },
        { id: "availability_empty", function: "no_availability", description: "Use when the schedule has no suitable options.", target: "no_availability", properties: {}, required: [], kind: "condition" },
        { id: "availability_failed", function: "availability_failed", description: "Use when the availability lookup fails.", target: "availability_error", properties: {}, required: [], kind: "failure" },
      ],
    },
    {
      id: "offer_times", name: "offer_times", title: "Offer Times", type: "conversation",
      task_messages: [{ role: "developer", content: "Offer two short appointment options and ask which one the caller wants." }],
      edges: [
        { id: "time_selected", function: "select_time", description: "Use when the caller selects an available time.", target: "confirm_appointment", properties: { selected_time: { type: "string", description: "The selected appointment time." } }, required: ["selected_time"], kind: "condition" },
        { id: "time_declined", function: "decline_time", description: "Use when the caller does not want the offered options.", target: "declined_completion", properties: {}, required: [], kind: "condition" },
        { id: "time_unavailable", function: "no_suitable_time", description: "Use when none of the offered times work.", target: "no_availability", properties: {}, required: [], kind: "condition" },
      ],
    },
    {
      id: "confirm_appointment", name: "confirm_appointment", title: "Confirm Appointment", type: "conversation",
      task_messages: [{ role: "developer", content: "Read back the appointment details and ask for explicit confirmation." }],
      edges: [
        { id: "confirmation_to_booking", function: "confirm_booking", description: "Use after the caller explicitly confirms the appointment.", target: "book_appointment", properties: { explicit_confirmation: { type: "string", description: "The caller's explicit confirmation." } }, required: ["explicit_confirmation"], kind: "condition" },
        { id: "confirmation_declined", function: "cancel_booking", description: "Use when the caller declines the appointment.", target: "declined_completion", properties: {}, required: [], kind: "condition" },
      ],
    },
    {
      id: "book_appointment", name: "book_appointment", title: "Book Appointment", type: "tool",
      task_messages: [{ role: "developer", content: "Book the confirmed appointment using the mock booking tool." }],
      tool: { name: "book_appointment", description: "Creates a mock appointment after confirmation.", confirmationRequired: true, mockResult: { booked: true } },
      edges: [
        { id: "booking_success", function: "booking_success", description: "Use when the booking tool succeeds.", target: "booking_complete", properties: {}, required: [], kind: "success" },
        { id: "booking_failed", function: "booking_failed", description: "Use when the booking tool fails.", target: "booking_error", properties: {}, required: [], kind: "failure" },
      ],
    },
    {
      id: "booking_error", name: "booking_error", title: "Booking Error", type: "conversation",
      task_messages: [{ role: "developer", content: "Say exactly: \"Error: I could not complete that check. I will connect you to staff.\"" }],
      edges: [{ id: "booking_error_to_staff", function: "booking_error_handoff", description: "Use after the booking error message.", target: "staff_handoff", properties: {}, required: [], kind: "failure" }],
    },
    {
      id: "availability_error", name: "availability_error", title: "Availability Error", type: "conversation",
      task_messages: [{ role: "developer", content: "Say exactly: \"Error: I could not complete that check. I will connect you to staff.\"" }],
      edges: [{ id: "availability_error_to_staff", function: "availability_error_handoff", description: "Use after the availability error message.", target: "staff_handoff", properties: {}, required: [], kind: "failure" }],
    },
    {
      id: "cancel_confirmation", name: "cancel_confirmation", title: "Cancel Appointment", type: "conversation",
      task_messages: [{ role: "developer", content: "Confirm that the caller wants to cancel the appointment." }],
      edges: [{ id: "cancel_to_complete", function: "confirm_cancellation", description: "Use after the caller confirms cancellation.", target: "cancellation_complete", properties: {}, required: [], kind: "condition" }],
    },
    { id: "booking_complete", name: "booking_complete", title: "Booking Complete", type: "end", end: true, task_messages: [{ role: "developer", content: "Confirm the booking, thank the caller, and end the call." }], edges: [] },
    { id: "cancellation_complete", name: "cancellation_complete", title: "Cancellation Complete", type: "end", end: true, task_messages: [{ role: "developer", content: "Confirm the cancellation and end the call." }], edges: [] },
    { id: "declined_completion", name: "declined_completion", title: "No Booking", type: "end", end: true, task_messages: [{ role: "developer", content: "Acknowledge the choice, offer future help, and end the call." }], edges: [] },
    { id: "no_availability", name: "no_availability", title: "No Availability", type: "end", end: true, task_messages: [{ role: "developer", content: "Explain that no suitable time is available and end the call." }], edges: [] },
    { id: "verification_handoff", name: "verification_handoff", title: "Verification Handoff", type: "transfer", end: true, task_messages: [{ role: "developer", content: "Complete the staff handoff." }], transfer: { reason: "Identity verification failed.", context: "Staff should complete verification before scheduling." }, edges: [] },
    { id: "urgent_handoff", name: "urgent_handoff", title: "Urgent Handoff", type: "transfer", end: true, task_messages: [{ role: "developer", content: "Complete the urgent-care staff handoff." }], transfer: { reason: "Caller reported an urgent concern.", context: "Do not continue routine scheduling." }, edges: [] },
    { id: "staff_handoff", name: "staff_handoff", title: "Staff Handoff", type: "transfer", end: true, task_messages: [{ role: "developer", content: "Complete the handoff to clinic staff." }], transfer: { reason: "The automated flow needs staff assistance.", context: "Share the collected appointment context with staff." }, edges: [] },
  ],
}

export const agentTemplates: AgentTemplate[] = [
  { id: "scheduler", name: "Clinic Scheduler", description: "Start with a tested appointment scheduling flow.", config: { ...exampleAgent, name: "Clinic Scheduler" } },
  { id: "intake", name: "Patient Intake", description: "Collect basic caller information and hand off the next step.", config: intakeAgent },
  { id: "test", name: "Prosper Flow Test Agent", description: "Explore a realistic multi-outcome graph with tools, warnings, errors, and handoffs.", config: showcaseAgent },
]

export function getAgentTemplate(id: AgentTemplate["id"]): AgentTemplate {
  return agentTemplates.find((template) => template.id === id) ?? agentTemplates[0]
}
