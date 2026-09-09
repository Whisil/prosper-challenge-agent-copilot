# Backend engineering guide

This document is the backend reference for the Prosper Agent Composer. It describes the runtime, local control API, validation boundary, storage, and AI configuration.

## Contents

- [Run the backend](#run-the-backend)
- [Responsibilities](#responsibilities)
- [Configuration](#configuration)
- [Runtime flow](#runtime-flow)
- [Control API](#control-api)
- [Draft loading and validation](#draft-loading-and-validation)
- [Sessions and trace events](#sessions-and-trace-events)
- [AI review and proposals](#ai-review-and-proposals)
- [Storage](#storage)
- [Changing models or ports](#changing-models-or-ports)
- [Tests and troubleshooting](#tests-and-troubleshooting)

## Run the backend

Install dependencies and start the service from the repository root:

~~~bash
make install
make run
~~~

make run starts two HTTP surfaces in one process:

- Pipecat browser voice client: http://127.0.0.1:7860
- Local control API: http://127.0.0.1:8000

The frontend calls the control API on port 8000 and opens the voice client on port 7860. Port 7860 is not a replacement for the control API.

The runtime entry point is backend/bot.py. The control server is implemented in backend/control_api.py.

## Responsibilities

The backend owns:

- Loading and validating runtime AgentConfig data.
- Compiling the graph into Pipecat FlowManager nodes.
- Activating the frontend's saved draft for the next call.
- Creating and tracking local test sessions.
- Recording runtime node, transition, tool, handoff, and ended events.
- Reviewing completed traces with OpenAI.
- Returning constrained ChangeProposal data for the frontend to review.

The backend does not own the browser agent collection, editor layout, undo/redo, call-history persistence, or proposal persistence.

The compatibility boundary is deliberate:

~~~text
AgentDocument from frontend
  -> frontend strips editor-only metadata
  -> POST /api/draft
  -> AgentBuilder validates AgentConfig
  -> Pipecat runtime loads the active document
~~~

## Configuration

backend/.env is the source of backend credentials and Copilot model configuration:

~~~env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6-luna
ELEVENLABS_API_KEY=...
PROSPER_CONTROL_PORT=8000
PROSPER_STATE_DIR=backend/.local
~~~

Only the first three are required for the normal voice/review workflow. The port and state directory are optional.

Configuration is loaded by backend/config.py. copilot_model() reads OPENAI_MODEL and fails clearly when it is missing. The OpenAI key remains on the backend.

There are two intentionally separate model settings:

- AgentConfig.model selects the voice runtime model for the active agent.
- OPENAI_MODEL selects the Copilot model for call review and proposal generation.

To change the Copilot model, edit backend/.env and restart make run. Do not add the Copilot model to frontend/.env. To change the voice model, edit the active agent document or template's model field.

## Runtime flow

A browser test call follows this sequence:

1. The frontend validates and posts the current runtime document to POST /api/draft.
2. The frontend creates a session with POST /api/test-sessions.
3. The frontend opens the Pipecat browser client.
4. bot.py starts or joins the voice pipeline.
5. AgentBuilder loads the session document, or the active draft, or the fallback example flow.
6. Runtime callbacks record events against the explicit test-session ID.
7. The frontend polls GET /api/test-sessions/{session_id}.
8. End or Handoff evidence marks the call terminal and the frontend stores a local CallRecord.
9. The frontend can request a post-call review.

Session-scoped preview documents are supported by the session creation payload, but the final challenge demo does not present the graph-fix preview as a finished workflow.

## Control API

The local control API is intentionally small:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /api/health | Confirm the control server is reachable |
| GET | /api/draft | Inspect the active draft or fallback state |
| POST | /api/draft | Validate and activate a runtime draft |
| POST | /api/test-sessions | Create a normal or session-scoped test session |
| GET | /api/test-sessions/{id} | Read session status and events |
| POST | /api/test-sessions/{id}/complete | Reconcile a terminal or disconnected session |
| POST | /api/copilot/review-call | Review a completed trace |
| POST | /api/copilot/propose | Generate a constrained stable-ID proposal |

The API is local-only and unauthenticated for the challenge. It should not be exposed as a production service.

The API uses JSON and returns an error message in an error field for non-2xx responses. The frontend wraps connection failures with the configured API URL so port and startup problems are visible.

## Draft loading and validation

backend/agent_builder/schema.py defines the runtime contract:

- One initial_node.
- Nodes with conversation, tool, transfer, or end types.
- Nested edges with exact target runtime names.
- Structured edge properties and required field names.
- End and transfer nodes are terminal.

backend/agent_builder/builder.py loads and compiles the graph. It rejects malformed nodes, unknown targets, invalid property/required combinations, unreachable nodes, cycles, and non-terminating paths.

Draft precedence is:

1. A document attached to the test session.
2. The active draft in backend/.local/active_draft.json.
3. backend/example_flow.json as a clear fallback.

The frontend editor's stable IDs and layout metadata are not runtime fields. The adapter sends the runtime-shaped document only. Titles are for display; targets and initial_node use exact runtime names.

## Sessions and trace events

control_api.py keeps active sessions in memory for the local process. Each session contains an ID, draft version, status, timestamps, optional session document, and trace events.

Runtime events are associated with an explicit session ID whenever available. Event payloads include human-readable titles and structured transition context where the runtime can provide it. The frontend uses those fields to create readable timeline entries instead of showing raw event names.

Terminal evidence includes:

- End-node or Handoff entry.
- Handoff/tool result where applicable.
- An ended event or completed session state.

This is trace evidence, not a transcript system. The backend must not claim that it stored a full conversation transcript.

## AI review and proposals

The AI boundary is in control_api.py and uses the OpenAI client on the backend.

Review input is constrained to:

- The tested document.
- Draft version.
- Completed trace.
- Optional issue/evidence text supplied by the frontend.

Proposal input adds:

- The complete current document.
- Node and edge reference indexes.
- Stable IDs available for nodeId, sourceNodeId, and edgeId.
- Allowed node types and edge kinds.
- The explicit operation contract.
- Evidence separated from system instructions.

Proposal output is not a replacement document. It is a ChangeProposal containing diagnosis, assumptions, questions, risks, tests, and stable-ID GraphOperation values. The backend rejects unknown operations, null or unknown references, title/function substitutions, protected entry-node deletion, terminal outgoing edges, invalid properties, and invalid resulting graphs.

Structured outputs are requested with JSON Schema and no temperature parameter. A proposal with zero operations is valid when the evidence does not justify a change. The frontend must still require human approval before any local mutation.

Call review and proposal generation are intentionally deterministic in shape but model-backed in the backend. If the key or model is unavailable, the API returns an actionable error; it does not silently create a fake graph change.

## Storage

The active runtime draft is written to:

~~~text
backend/.local/active_draft.json
~~~

The state directory can be changed with PROSPER_STATE_DIR. The local directory is runtime state and must not be committed.

Sessions are process-local for this challenge. Restarting the backend clears in-memory session status. Browser-local call records remain in the frontend's local storage.

There is no backend database, multi-user storage, transcript warehouse, analytics dashboard, proposal store, or authentication layer.

## Changing models or ports

To use another Copilot model:

1. Edit OPENAI_MODEL in backend/.env.
2. Restart make run.
3. Check GET /api/health.
4. Run a call review or proposal request from the frontend.

To move the control API:

1. Set PROSPER_CONTROL_PORT in backend/.env.
2. Restart the backend.
3. Set VITE_AGENT_API_URL to the matching URL in frontend/.env.
4. Restart the frontend dev server.

The voice client URL is independent. Keep VITE_VOICE_CLIENT_URL aligned with the Pipecat port.

## Tests and troubleshooting

Run backend tests:

~~~bash
UV_CACHE_DIR=/tmp/prosper-uv-cache uv run --directory backend pytest
~~~

Useful checks:

~~~bash
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1:8000/api/draft
~~~

Common failures:

- Connection refused on port 8000: the control server is not running, or the frontend points to the wrong port.
- Port 7860 opens but the frontend cannot activate a draft: the voice client and control API are separate surfaces; start the control API through make run.
- Missing OPENAI_MODEL: set it in backend/.env and restart.
- Review/proposal 502: inspect backend logs, confirm OPENAI_API_KEY, model access, and request size.
- Runtime uses example_flow.json: no active draft or session-scoped document was available.
- A changed graph does not appear in a call: save/activate the draft before creating a new test session.

For frontend state, local storage, and graph ownership, see Frontend engineering guide (frontend-architecture.md).
