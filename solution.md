# Prosper Agent Copilot — Solution Overview

## What was built

A visual workspace for designing and testing healthcare voice-agent workflows. The core idea is to represent the agent as a graph:

- Nodes describe what the agent says or does.
- Transitions describe when the conversation moves to another node.
- End and Handoff nodes make completion and escalation explicit.
- Validation helps the user find incomplete or unsafe graph configuration before a call.

The product follows the research direction of **define → test → observe → diagnose**. A user builds a workflow, runs a voice test call, reviews the recorded path, and can use the resulting evidence as input for future AI-assisted improvements.

The fresh workspace opens with one **Prosper Flow Test Agent**. It is intentionally rich enough to demonstrate ordinary conversations, mock tools, success and failure paths, warnings, errors, human handoffs, information collection, and multiple terminal outcomes. Call history includes one sample call showing availability being shared before verification, so the review workflow can be demonstrated without a live call.

## Product flow

1. Start with the showcase agent, a scheduler template, an intake template, or a blank agent.
2. Add and connect nodes on the canvas.
3. Edit instructions, transition descriptions, and information to collect in the inspector.
4. Validate the graph and resolve blocking errors.
5. Save a local revision and run a Test call against that draft.
6. Open Call history after the call reaches an End or Handoff node.
7. Review the human-readable timeline, outcome, tool/handoff events, and AI call review.
8. Use the review as evidence for the constrained Copilot proposal workflow when needed.

The suggested graph-fix preview is currently under development and was intentionally dropped from the final test-task demo. The reliable demonstrated experience is the editable graph, validation, active-draft Test call, Call history, and AI review.

## Key decisions and trade-offs

### Graph-first editing

The canvas is the source of truth for topology. Users create transitions by dragging between visible connection dots; the inspector configures the meaning of an existing transition. This is more understandable than mixing graph connections with dropdown-based form editing.

The trade-off is that the editor has fewer convenience shortcuts than a workflow platform. That is deliberate: a smaller interaction model makes the relationship between the graph and the runtime easier to understand.

### One entry point and explicit terminal nodes

The graph has one protected `initial_node`. End and Handoff nodes are terminal and cannot have outgoing transitions. Handoff nodes represent a safety boundary where automation stops and staff take over.

Branch nodes were removed because ordinary transitions already express routing. Keeping both a Branch abstraction and transition conditions made the builder harder to understand without adding value for this task.

### Stable runtime identifiers and display titles

Machine-safe node and edge identifiers are kept separate from human-readable titles. Copilot operations refer to stable IDs, while users see normal names such as “Offer Times” instead of `offer_times`. This prevents renaming a display title from silently changing runtime references.

### Local persistence

Agents, drafts, revisions, layouts, and call history are stored in browser local storage. This keeps the challenge self-contained and makes the demo deterministic without requiring authentication, a database, or multi-user infrastructure.

The trade-off is that data is browser-local and not suitable for collaboration or production deployment. The backend remains responsible for validating and running the selected draft, but it does not become a second source of truth for the editor.

### Evidence instead of a large feedback system

Call history stores traces, not a transcript warehouse. It turns runtime events into short, human-readable steps and starts AI review only after a terminal outcome. The sample call makes the evidence loop reviewable when voice services are unavailable.

This is intentionally narrower than a full call analytics product. It avoids pretending that lightweight traces contain information the system did not actually collect.

## Architecture at a glance

```text
React workspace
  -> local AgentDocument and revision history
  -> graph validation and React Flow adapter
  -> active-draft control API
  -> Pipecat runtime and browser voice client
  -> session trace
  -> local Call history and post-terminal AI review
```

The frontend owns editing, layout, local persistence, call-history presentation, and review state. The backend owns runtime execution, draft activation, session events, validation at the runtime boundary, and the AI API boundary. Layout never enters runtime semantics, and the AI cannot silently activate or publish a draft.

## Concise test walkthrough

1. Install dependencies with `make install` and `make frontend-install`.
2. Configure `backend/.env` with the required voice credentials, `OPENAI_API_KEY`, and `OPENAI_MODEL`.
3. Start the backend with `make run` and the frontend with `make frontend-dev`.
4. Open `http://localhost:5173` in a clean browser profile or clear the local storage keys `prosper-agent-collection-v1` and `prosper-call-history-v1`.
5. Confirm the only initial agent is **Prosper Flow Test Agent** and that the graph contains conversation, tool, Handoff, and End nodes.
6. Open the sample Call history record and confirm its completed review identifies the missing verification step.
7. Edit a node or create a transition, click **Validate**, then save the draft.
8. Run **Test call**, reach an End or Handoff node, and confirm the status panel dismisses while the completed record appears in Call history.

See the [frontend engineering guide](docs/frontend-architecture.md) for client ownership and the [backend engineering guide](docs/backend-architecture.md) for runtime, API, validation, storage, and model configuration.
