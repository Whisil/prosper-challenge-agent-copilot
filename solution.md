# Prosper Agent Copilot — Solution Walkthrough

## Product position

Prosper is a reviewable builder for healthcare voice-agent workflows. Phase 1 lets a user define, validate, save, and test a graph. The lean Phase 2 slice turns a call trace plus human feedback, or a written guideline, into a structured AI proposal that the user can preview and approve.

## User flow

1. On first open, choose the Clinic Scheduler template, Patient Intake template, or describe the desired agent.
2. Build and validate the local graph.
3. Save and run a draft-aware Test call.
4. Open Call history, inspect the runtime trace, and add plain-language feedback.
5. Ask the Evidence-to-Flow Copilot to diagnose the evidence.
6. Review stable-ID operations, risks, questions, and regression-test text.
7. Preview the proposal, optionally run a preview call, then apply selected changes.
8. Save a new local revision and run the active draft again.

## Boundary decisions

- `AgentDocument` is the frontend editor artifact. The backend keeps `AgentConfig` as its runtime-compatible contract.
- Stable IDs are used by Copilot operations; display titles remain human-readable.
- Layout is editor-only and never reaches Pipecat semantics.
- The backend owns the OpenAI key and validates structured proposal responses.
- The frontend owns local drafts, call history, feedback, proposal review, immutable operation application, and local revisions.
- Preview documents are attached to one test session and never activate themselves.

## Intentionally small scope

The Copilot has one endpoint and no backend proposal database. Call history is browser-local and contains runtime traces, not transcripts. Two synthetic demo calls provide evidence without requiring a live call. Tool, branch, transfer, and end-node behavior is demonstrative metadata. There is no production EHR, telephony deployment, PHI workflow, analytics warehouse, collaboration, authentication, arbitrary code execution, or HIPAA claim.

There is no standalone simulator or hidden deterministic Copilot scenario runner. The only preview is a validated proposal document sent to the same backend runtime boundary used by a normal test call.

## Safety choices

- Model output must be JSON-shaped and use a small allowlist of graph operations.
- Unknown references, malformed patches, protected entry-node deletion, identifier replacement, and oversized evidence are rejected.
- Empty operations are valid when the evidence does not justify a safe change.
- No proposal is applied, saved, or activated without explicit user actions.
- Missing backend or OpenAI configuration produces an actionable error instead of a fabricated result.

## Five-minute demo

Start the services using `docs/development.md`, choose Clinic Scheduler, and inspect the graph. Run a Test call if voice credentials are available. Open Call history and choose a synthetic demo record or add feedback to the new call. Analyze it with Copilot, inspect the returned diagnosis and operations, clear one operation, preview the remaining patch, and run a preview call. Apply the selected operations, save the revision, and run Test call again to verify the active draft version.

See [`docs/product-code-flow.md`](docs/product-code-flow.md) for the code path and [`docs/development.md`](docs/development.md) for exact commands and troubleshooting.
