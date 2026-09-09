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

The first browser open shows onboarding when no saved agent collection exists. The user selects Clinic Scheduler, Patient Intake, or Blank agent. The selected local document is added immediately. **Describe with AI** remains a disabled future affordance and performs no request, so the current graph cannot be replaced before the user has used the builder.

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

`bot.py` emits node, transition, mock tool, handoff, and ended events through `control_api.record_runtime_event`. Events are keyed by the browser session ID. The frontend polls the session and writes the latest record to local storage.

## Observe and review

```text
TestSessionPanel
  -> CallRecord in browser local storage
  -> CallHistoryWorkspace
  -> automatic AI review
```

Call history stores status, draft version, timestamps, runtime events, demo flags, and optional `CallReview` under `prosper-call-history-v1`. It does not store a transcript. Completed and failed sessions call `POST /api/copilot/review-call` once; two synthetic demo calls include clearly labelled review results so the workflow is visible without placing a real call.

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

The backend owns `OPENAI_API_KEY` and `OPENAI_MODEL`. It treats evidence as untrusted text, supplies a fixed graph and operation contract, limits proposal size, rejects malformed JSON and unknown operations, and blocks protected entry-node deletion. It also rejects display titles used as runtime references, identifier changes, invalid typed-node metadata, invalid property/required pairs, and invalid final graph structure. The backend does not persist proposals.

The frontend shows diagnosis, confidence, assumptions, risks, questions, regression-test text, and stable-ID `GraphOperation` checkboxes. `operationApplier` applies selected operations immutably and re-runs validation. Zero-operation proposals are valid and communicate that no safe change is recommended. Applying requires a validated preview; saving remains an explicit top-bar action.

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
- The frontend owns onboarding, the local agent collection, call history, AI review display, proposal review, operation application, and local revisions.
- Tool, branch, transfer, and end behavior is synthetic/demo metadata; there is no EHR, production telephony, PHI workflow, analytics warehouse, collaboration, or HIPAA claim.
- There is no standalone simulator, hidden deterministic scenario runner, automatic transcript analysis, or server-side multi-agent workspace; the agent list is browser-local.
