# Product and Code Flow

This is the short walkthrough of the implemented product. `docs/research.md` remains the product reference; this file explains how the current lean slice realizes define, test, observe, diagnose, patch, replay, and publish.

## First open and agent setup

```text
AppShell
  -> useAgentGraph
  -> loadAgentCollection or open AgentCreationDialog
  -> agentTemplates / createBlankAgent
  -> local AgentCollection of AgentDocument drafts
```

The first browser open with no saved collection creates and persists exactly one **Prosper Flow Test Agent** showcase graph. It is immediately active and demonstrates the builder through ordinary transitions, tools, warnings, errors, handoffs, and terminal outcomes. Additional Clinic Scheduler, Patient Intake, or Blank agents can be added from the agent menu without replacing the current agent. **Describe with AI** remains a disabled future affordance and performs no request.

`useAgentGraph` owns the present draft, undo/redo history, selected node, and serializable editor mutations. `AgentDocument` is the frontend representation with stable IDs, titles, typed nodes, version, revision, and runtime-compatible fields. `AgentDraft.layout` contains only canvas positions.

## Build and validate

```text
NodeCreationDialog / AgentGraph / NodeInspector
  -> useAgentGraph editor action
  -> AgentDraft history
  -> validateAgentConfig
  -> flowAdapter
  -> React Flow canvas
```

The graph is edited locally. Canvas connections create transitions; forms edit node and transition metadata. The validator provides structured field locations. `ValidationSummary`, graph markers, and `NodeInspector` read the same errors. Saving writes an immutable local snapshot; browser-local serialization is used only for persistence.

## Test calls

```text
current AgentDocument
  -> validate
  -> POST /api/draft
  -> POST /api/test-sessions
  -> browser client with session_id
  -> bot.py
  -> session document or active draft or example_flow fallback
  -> AgentBuilder
  -> Pipecat FlowManager
  -> runtime trace events
```

Normal Test call activates the current document, creates a session, and opens the configured Pipecat browser client. A Copilot preview call sends a validated proposal document in the session request; the backend keeps it attached to that session only and does not write it to the active draft. If no active draft exists, the runtime falls back to `backend/example_flow.json`.

`bot.py` emits node, transition, mock tool, handoff, and ended events through `control_api.record_runtime_event`. Events are keyed by the browser session ID. A terminal End or Handoff transition adds terminal metadata and completes the exact session. The frontend polls the session, recognizes terminal evidence if needed, and writes the completed record to local storage. Pipecat disconnect remains an idempotent completion fallback.

## Observe and review

```text
TestSessionPanel
  -> CallRecord in browser local storage
  -> CallHistoryWorkspace
  -> automatic AI review
```

Call history stores status, draft version, timestamps, runtime events, an optional `CallReview`, and a sample marker under `prosper-call-history-v1`. It does not store a transcript. Completed and failed sessions call `POST /api/copilot/review-call` once with a bounded request timeout; unavailable reviews can be retried. Prosper Flow Test Agent has one pre-reviewed sample call so the workflow is visible without a live voice call. The session overlay is dismissed after terminal status while the record remains available.

## Diagnose and patch

```text
call review + trace or guideline + current AgentDocument
  -> createCopilotProposal
  -> POST /api/copilot/propose
  -> backend OpenAI request
  -> ChangeProposal JSON
  -> CopilotPanel review
  -> operationApplier
```

The backend owns `OPENAI_API_KEY` and the single Copilot `OPENAI_MODEL` setting. It treats evidence as untrusted text, supplies the complete document plus stable node/edge reference indexes and the fixed operation contract, and requests strict JSON Schema Structured Outputs without temperature. It limits proposal size, rejects malformed JSON and unknown operations, and blocks protected entry-node deletion. It also rejects null or unknown references, display titles used as runtime references, identifier changes, duplicate edge introduction, invalid typed-node metadata, invalid property/required pairs, and invalid final graph structure. Added nodes may include their complete outgoing edges or receive them through `add_edge`, but an edge ID can only be introduced once. The backend does not persist proposals.

The frontend shows diagnosis, confidence, assumptions, risks, questions, regression-test text, and stable-ID `GraphOperation` checkboxes. `operationApplier` applies selected operations immutably and re-runs validation. Zero-operation proposals are valid and communicate that no safe change is recommended. Suggested graph-fix preview/apply remains under development and was dropped from the final test-task demo; the working evidence surface is the call review itself.

## Preview, approve, and publish locally

```text
selected operations
  -> immutable document preview
  -> optional preview test call
  -> human Apply selected
  -> local Save revision
  -> active draft on next Test call
```

Preview is not a second simulator and does not change the draft. Applying changes updates the same local editor state used by manual edits. Saving increments the local revision and persists it. Only the user can apply or save; the AI cannot publish silently.

## Boundaries and intentionally omitted features

- Layout metadata never enters runtime semantics.
- The backend knows runtime validation, active-draft activation, test sessions, and the one Copilot proposal endpoint. It does not store proposals or call history.
- The frontend owns onboarding, the local agent collection, call history, AI review display, proposal preview/review, operation application, and local revisions. Graph connection-side metadata is editor-only.
- Tool, transfer, and end behavior is synthetic/demo metadata; there is no EHR, production telephony, PHI workflow, analytics warehouse, collaboration, or HIPAA claim. Branch nodes are intentionally not part of the current editor; ordinary transitions provide routing.
- There is no standalone simulator, hidden deterministic scenario runner, automatic transcript analysis, or server-side multi-agent workspace; the agent list is browser-local.
