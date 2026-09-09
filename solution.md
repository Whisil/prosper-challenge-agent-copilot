# Prosper Agent Copilot — Solution Walkthrough

## Product position

Prosper is a reviewable builder for healthcare voice-agent workflows. Phase 1 lets a user define, validate, save, and test a graph. The lean Phase 2 slice automatically reviews a call trace and turns that review, or a written guideline, into a structured AI proposal that the user can preview and approve.

## User flow

1. On first open, choose the Clinic Scheduler template, Patient Intake template, or blank agent. Initial AI graph creation is visible as a disabled Coming soon affordance.
2. Build and validate the local graph.
3. Save and run a draft-aware Test call.
4. Open Call history and read the human-readable timeline and automatic review after the flow reaches an End or Handoff node; Prosper Flow Test Agent provides one dependable sample call without a live voice call.
5. Ask the Evidence-to-Flow Copilot to diagnose the review or a guideline.
6. Review stable-ID operations, risks, questions, and regression-test text.
7. Preview the proposal, optionally run a preview call, then apply selected changes.
8. Save a new local revision and run the active draft again.

## Boundary decisions

- `AgentDocument` is the frontend editor artifact. The backend keeps `AgentConfig` as its runtime-compatible contract.
- Stable IDs are used by Copilot operations; display titles remain human-readable.
- Layout is editor-only and never reaches Pipecat semantics.
- The backend owns the OpenAI key and the single `OPENAI_MODEL` configuration. It requests strict JSON Schema Structured Outputs without temperature and validates structured proposal responses.
- The frontend owns the local agent collection, drafts, call history, AI review display, proposal preview/review, immutable operation application, and local revisions. Connection-side metadata is editor-only and never enters runtime JSON.
- Preview documents are attached to one test session and never activate themselves.

## Intentionally small scope

The Copilot has three focused endpoints and no backend proposal database. Call history is browser-local and contains runtime traces, not transcripts. One sample call attached to Prosper Flow Test Agent provides evidence without requiring a live call. Branch nodes were intentionally removed because ordinary transitions already express routing and a second routing abstraction confused the builder; transfer nodes remain for healthcare safety but are terminal handoff boundaries. Tool, transfer, and end-node behavior is demonstrative metadata. There is no production EHR, telephony deployment, PHI workflow, analytics warehouse, collaboration, authentication, arbitrary code execution, or HIPAA claim. The multi-agent list is browser-local only.

There is no standalone simulator, hidden deterministic Copilot scenario runner, or initial AI graph-generation endpoint. AI-generated graph-fix preview/apply is explicitly under development and was dropped from the final test-task demo; the dependable demonstrated slice is the editable graph, Test call, Call history, and AI review evidence.

## Safety choices

- Model output must match a strict closed JSON Schema and use a small allowlist of graph operations. The prompt includes the complete current document and exact stable node/edge reference tables. Allowed node types are conversation, tool, transfer, and end.
- The backend validates the proposal shape, stable-ID references, exact runtime edge targets, one-time edge introduction, type-specific metadata, properties/required matching, and the resulting graph before returning it. A new node may carry its complete outgoing edges or receive them through `add_edge`; an edge ID can only be introduced once.
- Titles are presentation-only. The model must use stable IDs for operation references and exact runtime names for edge targets; invalid output is rejected rather than silently repaired.
- Unknown references, malformed patches, protected entry-node deletion, identifier replacement, and oversized evidence are rejected.
- Empty operations are valid when the evidence does not justify a safe change.
- No proposal is applied, saved, or activated without explicit user actions.
- Missing backend or OpenAI configuration produces an actionable error instead of a fabricated result.

## Five-minute demo

Start the services using `docs/development.md`, open Prosper Flow Test Agent, and inspect its deliberate verification gap. Open Call history and select the sample call. Read its completed review and demonstrate the evidence loop; suggested graph-fix preview remains under development and is not part of the final challenge demo.

See [`docs/product-code-flow.md`](docs/product-code-flow.md) for the code path and [`docs/development.md`](docs/development.md) for exact commands and troubleshooting.
