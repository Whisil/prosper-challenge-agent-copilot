# Frontend engineering guide

This document is the frontend reference for the Prosper Agent Composer. It explains where state lives, how a graph edit becomes a runtime draft, and where to change the system safely.

## Contents

- [Run the frontend](#run-the-frontend)
- [Frontend boundaries](#frontend-boundaries)
- [State ownership](#state-ownership)
- [The agent data model](#the-agent-data-model)
- [Graph editing](#graph-editing)
- [Persistence and migration](#persistence-and-migration)
- [Validation](#validation)
- [Calls and call history](#calls-and-call-history)
- [AI boundaries](#ai-boundaries)
- [Configuration and model switching](#configuration-and-model-switching)
- [How to make a change](#how-to-make-a-change)
- [Tests and troubleshooting](#tests-and-troubleshooting)

## Run the frontend

From the repository root:

~~~bash
make frontend-install
make frontend-dev
~~~

The development server is normally available at http://localhost:5173.

The frontend reads these variables from frontend/.env:

~~~env
VITE_AGENT_API_URL=http://127.0.0.1:8000
VITE_VOICE_CLIENT_URL=http://localhost:7860/client
~~~

VITE_AGENT_API_URL points to the backend control API. VITE_VOICE_CLIENT_URL points to the Pipecat browser client. They are different services.

## Frontend boundaries

The frontend owns:

- Graph editing, layout, selection, and inspector state.
- Local agent collections, draft revisions, undo/redo, and call history.
- Client-side validation and validation navigation.
- The request/response boundary for draft activation, test sessions, reviews, and proposals.
- Rendering the graph and translating runtime trace data into readable call history.

The backend owns runtime execution, runtime validation, session events, and the OpenAI API boundary. Frontend components must not import backend Python code or OpenAI configuration.

The main composition is:

~~~text
AppShell
  ├─ useAgentGraph
  ├─ AgentGraph
  ├─ NodeInspector
  ├─ Topbar / workspace navigation
  ├─ CallHistoryWorkspace
  └─ CopilotPanel
       └─ agentApi.ts
~~~

AppShell coordinates workspace-level events. Feature code owns feature-specific behavior. frontend/src/lib/agentApi.ts is the only place that knows the HTTP control API paths.

## State ownership

### Workspace state

frontend/src/app/AppShell.tsx owns:

- The active workspace (agents or call-history).
- Selected call and Copilot evidence.
- Active test-call session polling.
- Review request coordination.
- Switching between graph and call-history views.

The graph and Copilot surfaces remain mounted when the workspace changes so an in-progress proposal or selection is not lost simply because the user navigates to Call history.

### Graph state

frontend/src/features/agent-graph/hooks/useAgentGraph.tsx owns:

- The active local agent.
- The current AgentDraft.
- Draft history and undo/redo.
- Node and edge mutations.
- Selected node and transition.
- Validation results.
- Saving and activating the draft.

A mutation is dispatched as a serializable editor action. React Flow objects, DOM events, and pointer events never enter AgentDraft.

### Feature storage

Browser-local storage keys are intentionally small and explicit:

| Key | Owner | Contents |
| --- | --- | --- |
| prosper-agent-collection-v1 | agentCollection.ts | Local agents and each agent's current draft |
| prosper-call-history-v1 | callHistoryStorage.ts | Completed test-call records and reviews |

The backend does not own this browser collection. That keeps editing responsive and makes the challenge demo self-contained.

## The agent data model

There are three related representations:

1. AgentDocument is the canonical editor document. It adds version, stable document id, and revision to the runtime-shaped graph.
2. AgentDraft wraps the document with editor-only layout and edgeHandles metadata.
3. AgentConfig is the runtime compatibility shape sent to the backend. The adapter removes layout and handle metadata before sending it.

Important files:

- frontend/src/features/agent-graph/model/type.ts — shared frontend types.
- frontend/src/features/agent-graph/lib/agentDocument.ts — migration and runtime adapters.
- frontend/src/features/agent-graph/lib/agentCollection.ts — local multi-agent storage.
- frontend/src/features/agent-graph/lib/agentOperations.ts — serializable mutations.
- frontend/src/features/agent-graph/lib/graphLayout.ts — initial and new-node positions.

Node types are conversation, tool, transfer, and end. transfer and end are terminal. Branch nodes are intentionally not part of the current contract; ordinary transitions provide routing.

Stable IDs and display names are separate:

- id, name, edge IDs, functions, targets, and property keys are machine-facing.
- title and rendered labels are human-facing.
- identifier.ts humanizes names such as record_details to Record Details.

There is one graph-level initial_node. The entry node cannot be deleted. Terminal nodes cannot be transition sources.

## Graph editing

features/agent-graph/components/AgentGraph.tsx adapts the draft to React Flow. flowAdapter.ts creates React Flow nodes and edges; the adapter is a rendering projection, not a second graph model.

A connection follows this path:

~~~text
React Flow Handle
  -> onConnect(source/target handle IDs)
  -> connection side metadata
  -> add_edge editor action
  -> AgentDraft.config.nodes[].edges[]
~~~

Each node has target dots on all four sides. Non-terminal nodes also have source dots. AgentDraft.edgeHandles stores the chosen source and target sides by stable edge ID. This metadata is not sent to the backend. Legacy edges default to bottom-source / left-target.

The inspector edits node instructions, persona overrides, and transition metadata. Transition topology is created on the canvas. Transition descriptions use one field, When to use. Information-to-collect fields become structured transition arguments; the first-user editor creates them as strings.

Deletion is handled in the graph hook and is shared by inspector and keyboard actions:

- The protected entry node is rejected.
- Deleting a node deletes inbound transitions and editor layout.
- Selection is cleared after deletion; another node is not auto-selected.

## Persistence and migration

Fresh storage is bootstrapped with two defaults: the rich Prosper Flow Test Agent showcase graph and the small Prosper Review Example graph used by the sample call-history record. Existing local collections are preserved; missing defaults are added without changing the active agent.

Adding a template or blank agent appends a new StoredAgent; it does not replace the current agent. Switching agents changes activeAgentId and preserves each agent's local draft.

Draft saving increments the document revision and stores the current local snapshot. The backend receives the saved runtime document only when the user activates/saves it for testing.

Legacy migrations live in agentDocument.ts and agentCollection.ts. Keep migrations one-way and explicit. Do not make UI components understand old runtime formats.

## Validation

validateAgent.ts is the client-side validation source used by the top-bar summary, inspector fields, and graph error markers. It reports structured locations for nodes, transitions, properties, and fields.

Validation covers, among other things:

- Required names and instructions.
- A valid initial node.
- Exact transition targets.
- Unique node/edge/function identifiers.
- Required information fields matching property keys.
- Reachability and terminal behavior.
- Tool and handoff configuration.

The backend validates again before activation or runtime loading. Client validation improves editing feedback; it is not a security boundary.

## Calls and call history

The call flow is:

~~~text
Save/activate AgentDocument
  -> POST /api/draft
  -> POST /api/test-sessions
  -> browser voice client on port 7860
  -> runtime events
  -> session polling
  -> terminal evidence
  -> local CallRecord
  -> POST /api/copilot/review-call
~~~

CallHistoryWorkspace stores readable summaries of node entries, transitions, tools, handoffs, and outcomes. It stores trace evidence, not a transcript. A completed End or Handoff event is the normal review trigger. If the backend/OpenAI review is unavailable, the record shows an actionable unavailable state instead of an endless loading state.

The sample record is linked to the showcase agent so the review workflow can be inspected without placing a live call. Real calls remain local to the browser.

## AI boundaries

The active AI path is post-call review and constrained proposal generation:

1. The backend reviews the completed trace and tested document.
2. The frontend displays the review and evidence.
3. A proposal request includes the current document, evidence, stable node/edge reference indexes, and an operation allowlist.
4. The backend returns stable-ID GraphOperation values and validates the resulting graph.
5. The frontend treats the proposal as untrusted and previews it immutably.

Allowed node types are fixed. Raw document replacement, arbitrary code, credentials, unknown IDs, protected entry-node deletion, and invalid terminal edges are rejected.

## Post-submission progress

Call-history suggested fixes are owned by `features/suggested-fix`, not by `CopilotPanel`. `useSuggestedFixFlow` captures the active agent, draft version, complete original `AgentDraft`, source call, and review. It owns loading, preview, stale, error, accept, and deny state.

The flow is:

```text
Call history → suggest-fix API → cloned draft + shared graph patcher → read-only graph preview → Accept/Deny
```

`features/agent-graph/lib/graphPatch.ts` is the shared immutable operation utility. It preserves layout and `edgeHandles`, assigns deterministic positions to added nodes, applies operations in order, and validates the preview. Accept calls `commitSuggestedFix` once after checking the same agent and draft version; that method increments the revision and persists the agent. Deny clears only the preview. A stale draft disables acceptance and requires a new suggestion.

The sample call can use a deterministic backend fallback for its known verification gap. Real-call failures do not mutate the graph. The generic guideline Copilot remains independent and continues to use its own proposal state.

## Configuration and model switching

There is no Copilot model setting in the frontend.

- Change VITE_AGENT_API_URL only when the control API host or port changes.
- Change VITE_VOICE_CLIENT_URL only when the Pipecat browser client URL changes.
- Change the voice runtime model in the active AgentDocument.model.
- Change the Copilot review/proposal model in backend/.env using OPENAI_MODEL.

Restart the backend after changing OPENAI_MODEL. The frontend never receives the OpenAI key or model credential.

## How to make a change

1. Find the owning feature under frontend/src/features.
2. Update the feature model before changing components if a contract changes.
3. Keep runtime conversion in agentDocument.ts or the relevant adapter.
4. Keep React Flow-specific mapping in flowAdapter.ts and AgentGraph.tsx.
5. Use serializable actions for draft mutations.
6. Update client validation and backend validation when a runtime rule changes.
7. Add or update tests near the owning feature.
8. Update this guide when ownership, commands, configuration, or API boundaries change.

Avoid putting graph mutations in presentational components or duplicating local-storage logic.

## Tests and troubleshooting

Run the frontend checks from the repository root:

~~~bash
CI=1 pnpm --dir frontend typecheck
CI=1 pnpm --dir frontend lint
CI=1 pnpm --dir frontend test
CI=1 pnpm --dir frontend build
~~~

Common issues:

- vite: command not found: run make frontend-install.
- Cannot reach 127.0.0.1:8000: start make run; port 7860 is the voice client, not the control API.
- A different control port: set PROSPER_CONTROL_PORT in backend/.env and update VITE_AGENT_API_URL.
- A stuck or unavailable AI review: check OPENAI_API_KEY, OPENAI_MODEL, backend logs, and the control API health endpoint.
- The graph looks stale after changing local templates: clear prosper-agent-collection-v1 in browser storage. This removes local agents, so back up needed work first.

For backend runtime and API details, see Backend engineering guide (backend-architecture.md).
