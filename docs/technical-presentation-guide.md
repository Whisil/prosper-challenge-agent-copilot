# Technical presentation guide

This guide is a practical explanation of the decisions behind Prosper Agent Composer. It is written for a reviewer who may inspect the code while asking why a boundary exists, what happens on failure, or how AI is constrained.

The short version is: Prosper turns a voice workflow into an editable graph, executes the saved graph in a local Pipecat call, records lightweight evidence, and lets AI propose a small reviewed patch rather than silently rewriting the agent.

## System map

```text
React workspace :5173
  ├─ graph editor, validation, local drafts and revisions
  ├─ Call history, transcript display, review state
  └─ HTTP client
         │
         ▼
Local control API :8000
  ├─ active draft and session registry
  ├─ graph validation and runtime evidence
  └─ OpenAI review/proposal boundary
         │
         ▼
Pipecat browser client :7860
  └─ ElevenLabs STT → OpenAI voice model → ElevenLabs TTS
         │
         ▼
terminal trace + bounded transcript
  → Call history → AI review → suggested-fix preview → Accept or Deny
```

There are deliberately two backend HTTP surfaces. Port 8000 is the small control API used by the React app. Port 7860 is Pipecat's browser voice client. Opening the voice client does not prove that the control API is running.

The main composition point in the browser is [`AppShell.tsx`](../frontend/src/app/AppShell.tsx). The voice entry point is [`bot.py`](../backend/bot.py). The local API and Copilot boundary live in [`control_api.py`](../backend/control_api.py).

## The agent model

The agent is JSON, but it has three useful representations:

| Representation | Owner | Why it exists |
| --- | --- | --- |
| `AgentDocument` | Frontend graph domain | Canonical editable agent: version, stable document ID, revision, nodes, and nested edges. |
| `AgentDraft` | Frontend graph editor | Wraps the document with editor-only node positions and connection-side metadata. |
| `AgentConfig` | Backend runtime | Compatibility shape consumed by `AgentBuilder` and Pipecat. |

The adapter removes `AgentDraft` layout data before a document reaches the backend. This means moving a node or changing the side used by an edge never changes the workflow's runtime behavior.

Nodes use four supported types:

- **Conversation** — one bounded conversational objective.
- **Tool** — a deterministic mock action with success/failure paths.
- **Transfer** — terminal staff handoff.
- **End** — terminal normal completion.

Branch nodes were intentionally removed. Ordinary transitions already express routing, while a separate Branch abstraction duplicated transition configuration and made the editor harder to explain. End and Transfer nodes cannot have outgoing edges. The initial node is protected from deletion.

Stable machine identifiers and human-readable labels are intentionally different:

- Node and edge IDs are used by traces, reviews, operations, and validation.
- Runtime names are used by `initial_node` and edge `target` references.
- Titles are only presentation text.

This avoids a display-title edit such as “Offer Times” accidentally breaking a runtime reference or an AI patch.

## How a test call starts and ends

### Start

1. The browser validates the current graph locally.
2. For a normal call, it sends the runtime document to `POST /api/draft`. The backend validates it again and writes the active draft under `backend/.local/`.
3. The browser creates a control session with `POST /api/test-sessions`.
4. It opens the Pipecat client with the generated `session_id` in its URL.
5. Pipecat loads, in order of preference: a document attached to that session, the active draft, or `backend/example_flow.json` as the fallback.

A preview call may carry a session-only document. That document is validated but never becomes the active draft.

### End

The frontend polls `GET /api/test-sessions/{id}` every **1.5 seconds** while a call is active. Polling is sufficient for a local challenge app, avoids maintaining another browser connection, and makes the session state easy to inspect and test.

Polling is not the source of truth for whether a call ended. Terminal graph evidence is:

- an `ended` event;
- a `handoff` event; or
- a node-entry event whose payload is marked `isTerminal`.

When `AgentBuilder` transitions into an End or Transfer node, it records the transition and node entry, then marks the explicit session complete. If the frontend observes terminal evidence before the session status changes, it calls `POST /api/test-sessions/{id}/complete` as an idempotent reconciliation step.

The browser then waits **two seconds**, fetches the session one final time, stores the completed call locally, and starts review once. The delay exists because a terminal graph event can happen just before the final assistant transcript turn arrives. A browser disconnect also calls backend completion and context recovery, but disconnect is only a fallback; closing a popup is not the primary completion signal.

The relevant code is in [`AppShell.tsx`](../frontend/src/app/AppShell.tsx), [`callHistoryStorage.ts`](../frontend/src/features/call-history/lib/callHistoryStorage.ts), [`AgentBuilder`](../backend/agent_builder/builder.py), and [`control_api.py`](../backend/control_api.py).

## Evidence: what the product records

The product keeps two forms of evidence because they answer different questions.

| Evidence | Captures | Does not prove |
| --- | --- | --- |
| Runtime trace | Nodes entered, transitions, collected fields, tool results, handoffs, terminal outcomes, validation failures, and runtime defects. | What the caller actually said. |
| Bounded transcript | Finalized user and assistant speech turns. | That the graph transition was valid or a tool succeeded. |

User turns are captured from Pipecat's finalized `on_user_turn_message_added` event. Assistant turns are captured from `on_assistant_turn_stopped`. On disconnect, the final LLM context is used as a deduplicating recovery path in case a final callback raced shutdown.

The transcript is capped at **120 turns** and **24,000 characters** per call. A trace-only call is still useful for execution debugging, but it cannot support a confident assessment of spoken behavior such as verification quality or an offered appointment choice. The review therefore returns **unavailable**, not a misleading pass, when evidence is insufficient.

Completed calls are stored in browser local storage under `prosper-call-history-v1`. The backend keeps active session state only in memory. This is intentional for a local challenge: it demonstrates the product loop without claiming to be a transcript warehouse, shared evidence system, or HIPAA-ready production platform.

## AI usage and prompts

All AI calls are backend-owned. The browser never receives OpenAI credentials or chooses the Copilot model. `OPENAI_MODEL` in `backend/.env` is the single setting for review and proposal generation. Voice-agent `AgentConfig.model` is separate because it controls the model running the call itself.

Every AI request uses Chat Completions with:

- a fixed system prompt;
- a JSON-serialized user payload;
- Strict JSON Schema structured output;
- no temperature parameter;
- backend validation after model output.

The fixed prompt treats transcripts, guidelines, call evidence, and historical records as **untrusted evidence**, never as instructions. This is a key prompt-injection boundary.

### 1. Call review

**When it runs:** once after a terminal real call is stored. It can be manually retried if it fails. It does not run for a deterministic runtime defect because the system already knows that is a platform problem. Seeded sample review data is precomputed so the demo remains usable without an AI request.

**Purpose of the prompt:** act as a cautious reviewer, not a graph editor. It checks intent handling, identity verification, unsafe disclosure, offered times, confirmation, tool success, human/urgent routing, and whether the outcome matched the graph.

**Inputs:** the tested `AgentDocument`, draft version, selected call's complete bounded trace/transcript, evidence quality, exact node/edge reference index, and compact history from the same agent.

**Output:** a structured `CallReview`: passed, needs attention, or unavailable; concise issues; severity; observed/expected behavior; optional stable locations; referenced transcript turn IDs; and a recommended action.

**Failure behavior:** API, model, timeout, malformed output, or insufficient evidence becomes a visible, retryable unavailable review. It is not converted into “no change.”

The prompt and response checks are in [`review_call`](../backend/control_api.py#L672) in `control_api.py`.

### 2. Generic guideline proposal

**When it runs:** only when the user asks the generic Copilot panel to turn a guideline or instruction into a graph proposal. It does not run automatically after a call.

**Purpose of the prompt:** return the smallest safe `ChangeProposal`, or zero operations when evidence does not justify a change.

**Inputs:** the full current graph, source evidence, stable reference index, allowed node types, allowed operation contract, and same-agent compact history.

**Output:** diagnosis, typed operations, assumptions, questions, risks, and generated regression-test text.

**Validation:** all references must be stable IDs; titles, array indexes, function names, `null`, and invented IDs are invalid references. Operations are dry-run in order against a copied document, then the complete graph is validated. The active draft is untouched.

See [`create_copilot_proposal`](../backend/control_api.py#L756).

### 3. Suggested fix from Call history

**When it runs:** only when a user clicks **Generate suggested fix** on an actionable review. It is separate from the generic guideline Copilot so its state cannot be confused with a general proposal.

**Purpose of the prompt:** prepare a small patch for the concrete reviewed problem.

**Inputs:** current graph, selected call trace/transcript, completed review, compact history, and exact node/edge index.

**Output:** a more restricted operation list: add node, add edge, update edge, or update selected node guidance. It cannot remove nodes or edges, change the entry node, rename stable IDs/functions, replace the document, publish, run code, or add arbitrary integrations.

**Failure behavior:** a real-call error leaves the graph unchanged. The one seeded availability-before-verification sample has a deterministic fallback patch, based on the current document's actual IDs, so the review flow can still be demonstrated when the model is unavailable or returns an invalid patch.

See [`create_suggested_fix`](../backend/control_api.py#L930) and the independent frontend controller [`useSuggestedFixFlow`](../frontend/src/features/suggested-fix/hooks/useSuggestedFixFlow.ts).

## Why AI does not directly replace graph JSON

JSON syntax is the easy part. A graph can be valid JSON and still be unusable because it has a duplicate edge ID, a target that names a title instead of a runtime name, an invalid required property, an unreachable node, a cycle without a terminal path, or an outgoing edge from an End node.

The model therefore proposes typed operations rather than replacing the graph. Deterministic code applies those operations to a deep copy and validates the result. The frontend then creates an immutable preview that preserves editor layout and edge-handle metadata.

The user sees **Suggested changes · not applied** and can move a new preview node. The normal inspector is disabled during preview. Then:

- **Accept** verifies the agent/version is still current, validates again, saves exactly one local revision, and records the accepted improvement.
- **Deny** discards the preview without mutating the graph, revision history, or active runtime draft.
- If a graph edit, save, agent switch, or another suggestion occurs first, the preview becomes stale and cannot be accepted.

This is a change-management design, not a chat box that edits prompts. It keeps the relationship between evidence, patch, validation, and approval inspectable.

## Cross-call improvement memory

Each terminal call creates a small same-agent `ImprovementRecord` in `prosper-improvement-memory-v1`. It records the outcome, review summary, issue locations, decision, tested version, and—in the case of an accepted proposal—the compact list of changed node/edge IDs and target changes.

It does **not** store another graph copy, unrelated traces, historical transcripts, or model-training data. The current selected call sends full evidence; earlier calls send at most 20 compact summaries for the same agent. Unavailable and pending reviews are excluded from future AI context.

Accepted changes provide a narrow deterministic conflict guard. For example, if an accepted fix redirected an edge from availability to verification, a later proposal that redirects that same edge back to availability is rejected. Rejected proposals are context, not permanent prohibitions. The current graph and its reference index always remain authoritative.

## Key design decisions and trade-offs

| Decision | Why | Trade-off |
| --- | --- | --- |
| Typed graph instead of one large prompt | Each node has a bounded purpose and inspectable transitions. | More editing concepts than a single text box. |
| Stable IDs separate from titles | Traces and AI patches survive title edits. | More fields in the data model. |
| Editor metadata outside runtime JSON | Layout changes cannot alter call behavior. | Requires a small adapter. |
| Browser-local agents/calls | Fast, self-contained demo with no database/auth scope. | Not shared, durable multi-user storage. |
| Frontend + backend validation | Fast editing feedback plus runtime safety. | Validation logic is intentionally duplicated at two boundaries. |
| Polling for local sessions | Simple, observable, and sufficient for one local caller. | Up to 1.5 seconds of UI update latency. |
| Terminal evidence over popup closure | Graph completion is meaningful; browser windows are unreliable. | Requires event reconciliation and a short finalization delay. |
| Deterministic mock tools | Tool success/failure paths are demonstrable and testable. | No live scheduling or availability system. |
| AI operations, not whole-document replacement | Limits agency and makes patches reviewable. | AI cannot perform broad autonomous rebuilds. |
| Bounded local transcript | Supports semantic review without building a transcript platform. | Older/failed calls can be trace-only and unreviewable. |
| Human Accept/Deny | No invisible graph mutation or runtime activation. | Adds a review step before the fix is used. |

## What changed from the starter backend

The starter backend was intentionally small: [`bot.py`](../backend/bot.py) loaded one static `example_flow.json`, built it with `AgentBuilder`, started Pipecat, and cancelled the worker when the browser disconnected. The original builder primarily checked the entry node and edge targets.

The current backend keeps Pipecat and the JSON graph model, but adds the minimum control and evidence layer needed for the challenge product.

| Starter capability | Current addition | Why it improves the product |
| --- | --- | --- |
| One static JSON flow | Active-draft activation and session-scoped preview documents | The edited graph can actually be test-called without overwriting the fallback. |
| No app-facing API | Local health, draft, session, completion, review, proposal, and suggested-fix endpoints | The React builder has a narrow typed boundary to the existing voice runtime. |
| Browser disconnect was the only lifecycle signal | Session IDs, events, terminal-state completion, polling, and reconciliation | Call history and review are tied to the correct call, even when popup lifecycle is imperfect. |
| No evidence capture | Node/transition/tool/handoff/end events and bounded transcript capture | Failures can be inspected rather than guessed. |
| Basic target validation | Node type, terminal, reachability, properties, required-field, tool, runtime guard, and graph validation | Broken or unsafe editor/AI graphs are rejected before runtime. |
| Tool behavior depended on the model choosing a route | Deterministic success/failure transition after a mock tool result | A tool result reliably drives the configured workflow and exposes missing paths as technical defects. |
| No AI boundary | Backend-owned review/proposal calls with strict schemas and dry-run validation | Credentials stay off the browser and AI cannot mutate the active runtime directly. |
| Default TTS settings | Sentence aggregation, text normalization, slower configurable pace, and spoken-time guidance | Scheduling details are more likely to be understandable in voice output. |

The backend remains intentionally local-only and unauthenticated. It does not add a database, a production EHR/scheduling integration, collaboration, deployment, or a compliance claim.

## Failure behavior worth calling out

- **Frontend cannot reach port 8000:** the UI explains that `make run` starts the control API and points to `VITE_AGENT_API_URL`.
- **Invalid graph:** client validation highlights the editing location; backend validation still blocks activation or preview sessions.
- **Tool has no matching success/failure path:** the runtime fails safely, records `runtime_defect`, and Call history offers a local technical report instead of an AI graph patch.
- **Transcript is missing:** review is unavailable for content-sensitive claims; the system does not claim the call “looks good.”
- **OpenAI unavailable, timeout, malformed JSON, unknown reference, or invalid graph:** no proposal is applied. The review is retryable; a suggested-fix request shows an actionable error. Only the seeded sample uses its deterministic fallback.
- **User changes the graph while a preview is open:** the preview is stale and Accept is disabled.
- **ElevenLabs voice output is rushed or reads clock notation poorly:** the runtime sends complete sentences, enables text normalization, uses `ELEVENLABS_TTS_SPEED` (default `0.92`), and asks the model to speak times as words, not as `2:00 PM`.

## Five-minute technical demo

1. Open the showcase graph. Explain the four node types, stable IDs, terminal nodes, and live validation.
2. Open the smaller review example and show the deliberate missing-verification route in the sample Call history record.
3. Run a normal test call. Explain draft activation, the created session ID, and the independent ports 8000 and 7860.
4. Open Call history. Contrast **Conversation** with **What happened**: transcript says what was spoken; trace says which graph path ran.
5. Explain that terminal event evidence starts review only after the call is complete, with a two-second final transcript wait.
6. Open the sample review. Generate a suggested fix and show that the loading state does not mutate the graph.
7. Show the preview's added verification node and redirected edge. Deny once to show no change; generate again and Accept to save one revision.
8. End with the safety boundary: AI suggests typed operations, deterministic code validates them, and a person explicitly accepts the change.

## Interview Q&A

### How do you know a call has ended?

The frontend polls the session endpoint every 1.5 seconds. It treats End/Handoff node entry, `ended`, or `handoff` evidence as terminal. The backend also marks the explicit session complete when the graph reaches a terminal node. The browser disconnect handler is a fallback only. The frontend waits two seconds for final transcript data before saving and reviewing the call.

### Why use polling instead of WebSockets or server-sent events?

The control API is local, session state is short-lived, and only one user is expected in the challenge. A 1.5-second poll is simpler to reason about, easy to test, and separates application control state from Pipecat's realtime media transport. A production multi-user monitor would likely use pushed updates.

### If the agent is JSON, why not let AI edit it directly?

JSON does not express graph correctness by itself. AI can produce valid JSON with broken targets, duplicate IDs, invalid terminal nodes, or unreachable paths. Typed operations plus deterministic dry-run validation keep the patch small, reviewable, and safe.

### Why validate on both frontend and backend?

The frontend gives immediate authoring feedback. The backend is the runtime and security boundary: it must revalidate any document, preview, or model output regardless of how it reached the API.

### How do you protect against prompt injection or unsafe model output?

Call text, transcript, guidelines, and history are sent as untrusted JSON evidence, separate from the fixed system prompt. Output is constrained through strict JSON Schema, an operation allowlist, stable reference indexes, bounded request/operation sizes, immutable dry-run application, graph validation, stale-version checks, and user approval. The model has no production credentials, code execution path, or direct publishing capability.

### What happens if OpenAI fails?

The graph stays unchanged. A review becomes retryable unavailable. A real-call suggested fix returns an actionable error. The seeded sample alone has a deterministic fallback so the presentation flow remains demonstrable without pretending an AI response succeeded.

### What happens if a tool route fails?

Mock tools deterministically select their configured success/failure route. If that route is missing, the session fails safely with `runtime_defect`. That is treated as a technical issue, not as a misleading AI prompt-change suggestion.

### Why store data in local storage instead of a backend database?

The challenge scope is a single local authoring experience. Browser-local agents, revisions, calls, transcripts, and compact improvement memory keep the demo self-contained and avoid claiming persistence, collaboration, security, or compliance features that do not exist. The active runtime draft is the one small backend-local file needed to serve the next call.

### How do Accept, Deny, and stale preview protection work?

The suggested-fix controller captures a deep copy of the original draft and its version. It renders only a cloned preview. Accept checks that agent ID, version, and current draft still match; it validates again, saves one revision, and records the decision. Deny clears preview state and changes nothing. Any intervening graph edit, save, or agent switch makes the preview stale.

### How is voice quality handled?

The runtime uses sentence-level TTS aggregation, ElevenLabs text normalization, a slightly slower configurable voice pace, and a runtime rule to say times in words. The graph still uses exact enum values internally for validation; only the caller-facing wording is humanized.

### What would you add for production?

First: authenticated server-side persistence, a governed transcript-retention/privacy model, real scheduling integrations, stronger replay/regression suites, human correction of inaccurate reviews, pushed monitoring, and an explicit deployment/publish workflow. I would add those only with product, security, and operational requirements—not as hidden challenge scope.

## Related references

- [Solution overview](../solution.md)
- [Project crash course](project-crash-course.md)
- [Frontend engineering guide](frontend-architecture.md)
- [Backend engineering guide](backend-architecture.md)
- [Call feedback flow](call-feedback-flow.md)
- [Original task](task.md)
