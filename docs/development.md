# Development guide

This repository contains a Python voice-agent backend and a pnpm-managed React frontend. The frontend is a local Phase 1 graph workspace with versioned artifacts, validation, persistence, focused regression checks, and a local control boundary; the backend provides the runnable Pipecat voice agent and browser test-call client.

## Prerequisites

- Python 3.11+
- [uv](https://docs.astral.sh/uv/getting-started/installation/)
- Node.js 20.19+
- pnpm 10+
- OpenAI and ElevenLabs API keys for voice calls

## First-time setup

From the repository root:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
make install
make frontend-install
```

Add the required API keys to `backend/.env`. `OPENAI_API_KEY` and `OPENAI_MODEL` are required for call review and feedback-driven proposal endpoints. The Copilot model is configured only in the backend environment; the frontend does not receive model credentials. Initial AI graph creation is intentionally disabled. The frontend environment file may use the default test-call URL:

```bash
VITE_VOICE_CLIENT_URL=http://localhost:7860/client
VITE_AGENT_API_URL=http://127.0.0.1:8000
```

## Launch the backend

Run from the repository root:

```bash
make run
```

The Make target uses IPv4 loopback (`127.0.0.1`) for local runner compatibility while the browser client remains available at `http://localhost:7860/client`. It also uses a project-local uv cache so the command does not depend on permissions for the user's global cache directory. Override `RUNNER_HOST` or `UV_CACHE_DIR` when needed.

The Pipecat runner starts the voice agent and prints the browser client URL. The default is [http://localhost:7860/client](http://localhost:7860/client).

The backend starts the local control API on `http://127.0.0.1:8000`, loads the active validated draft when one has been activated, and otherwise falls back to `backend/example_flow.json`. It validates the graph and compiles it into a Pipecat Flows graph. The backend can also be started directly:

```bash
uv run --directory backend python bot.py
```

## Launch the frontend

In a separate terminal:

```bash
make frontend-dev
```

The Vite app is available at [http://localhost:5173](http://localhost:5173).

Equivalent direct commands:

```bash
pnpm --dir frontend install
pnpm --dir frontend dev
```

The frontend's **Test call** button validates and activates the current draft through the control API, creates a test-session record, and opens `VITE_VOICE_CLIENT_URL` with the session ID. Start the backend first if you want to place a real browser call. A Copilot preview call submits a validated proposal document only for that session; it never changes the active draft. The test-session drawer shows the draft version, connection state, and runtime events when available.

On first launch, or from the agent chevron and **Add agent**, choose the **Clinic Scheduler**, **Patient Intake**, or **Blank agent** option. These create valid local drafts and add them to the browser-local agent list. **Describe with AI** is visible but disabled with a Coming soon label; it makes no request and does not change the current agent. The dialog also asks for a name and optional global persona.

## Evidence-to-Flow Copilot

Open **Call history** to inspect local test calls or the single sample call attached to **Prosper Flow Test Agent**. Terminal calls are reviewed automatically by `POST /api/copilot/review-call`. You can also open the **Evidence-to-Flow Copilot** in the agent workspace and enter a guideline directly.

- The frontend sends the current document, draft version, evidence, and (for calls) the trace to `POST /api/copilot/propose`.
- The backend sends the complete current document, a compact node/edge reference index, and the explicit allowlist of node types and graph operations. It requests strict JSON Schema Structured Outputs with closed objects and non-null stable references; it rejects replacement documents, unknown fields, title-based references, identifier renames, invalid targets, invalid property/required pairs, unsafe node metadata, invalid final graphs, and duplicate edge IDs. A new node may include its complete outgoing edges or receive them through separate `add_edge` operations, but an edge ID may appear only once. Empty operations are valid when no change is justified.
- Inspect the diagnosis, confidence, assumptions, risks, questions, and generated regression text returned by the model.
- Select or clear individual stable-ID graph operations, then use **Preview** to validate an immutable proposal document.
- Use **Test preview** to run that proposal through the backend for one session without activating it.
- The suggested graph-fix preview and apply flow is under development and was dropped from the final challenge demo. Do not rely on it as a completed product path; use the editable graph, Test call, Call history, and AI review to demonstrate the working slice.

The Copilot is intentionally narrow: one backend endpoint, structured JSON proposals, a small operation limit, and explicit human approval. The backend does not persist proposals and the frontend stores only call history and drafts locally. If the API key or backend is unavailable, the UI shows the setup or connection error rather than silently fabricating a proposal.

## Call history and AI review

Each **Test call** creates an in-memory backend test session. While the call is running, the backend records runtime events such as node entry, transitions, mock tool calls, handoffs, and completion. Reaching an End or Handoff node marks that exact session complete. The frontend also recognizes terminal trace evidence if the session status has not yet caught up, then stores the completed record in browser local storage under `prosper-call-history-v1`. Pipecat disconnect remains a completion fallback. Sessions held by the backend are lost on backend restart, but the browser record and its AI review remain local.

In **Call history**, select a record to review its outcome summary, human-readable timeline, and AI review. Diagnosis starts only after an End or Handoff node is reached. A review is marked **Looks good**, **Needs attention**, or **Review unavailable**. Suggested graph-fix generation is still under development and was dropped from the final test-task demo; the reliable workflow ends at the evidence review. A failed or timed-out review exposes **Retry AI review** rather than staying in a pending state. There is no transcript store or general feedback form in this slice.

## Working with the project

Frontend code lives in `frontend/src`. Product behavior is organized under `frontend/src/features`; reusable UI primitives live under `frontend/src/components/ui`. The graph fixture, backend-shaped types, editor actions, and validation are in `frontend/src/features/agent-graph`.

In the agent workspace:

- Use the compact typed node palette to open a setup modal for a **Conversation**, **Tool**, **Transfer**, or **End** node. Each button has its own label, and the modal explains the node's purpose before collecting required details. Titles and task instructions are required; typed nodes also collect their required tool or handoff metadata. Stable IDs are generated separately from display titles, and the new node is selected immediately after creation. **Prosper Flow Test Agent** is the default showcase graph with a deliberate verification gap for the review demonstration.
- The graph has one entry point from `initial_node`. It cannot be deleted, and renaming it preserves its entry-point role. Terminal nodes are separate nodes and multiple terminal nodes are supported.
- Collapse the left sidebar with its chevron control when more canvas space is needed. Navigation labels return when it is expanded.
- Drag nodes directly on the canvas. The card follows the pointer with a raised shadow; the final position is stored only in the local draft layout.
- Select a node to edit its name, task instruction, optional node-specific guidance, and transition metadata. Graph cards show the node itself and its connection dots; transition details are edited in the inspector. Terminal nodes have no outgoing connector.
- Delete a selected node with the inspector action or the keyboard Delete key. Both paths update the local draft, remove inbound transitions, and clear validation for the deleted node. After deletion, no node is selected automatically; the inspector shows a selection prompt until the user chooses another node. The entry node remains protected in both the inspector and canvas keyboard flow.
- Create transitions only on the canvas: drag a small connection dot on any side of a regular node to a target dot on another node. The editor creates a generated transition and selects it in the inspector. Terminal nodes expose target dots but no outgoing source dots.
- The selected source and target sides are retained in editor-only draft metadata, so a connection dropped on the top, right, bottom, or left dot stays attached to those sides. This metadata is not sent to the backend runtime.
- Existing transition targets are shown as part of the saved graph configuration. This slice does not provide a retarget action; create a new transition from the canvas dot when adding a new path.
- Use the transition editor fields as follows:
  - **Transition name** is the unique function/action name exposed to the model.
  - The canvas connection determines the destination; the inspector focuses on transition semantics rather than offering a destination dropdown.
  - **When to use** tells the model which caller intent or situation should invoke the action.
  - **Information to collect** is optional structured information passed to the transition. Each item has a name, a plain-language description, and a required toggle. New items are sent as text; advanced property types remain part of the backend contract but are not exposed in the first-user editor.
- Invalid names, missing descriptions, unsupported property types, missing targets, and incomplete instructions are shown inline, on affected graph nodes, and in the top-bar validation status. Click the top-bar status to open the exact node, transition, property, and field locations. Warnings do not prevent local editing; blocking errors prevent saving or activating the draft.
  - Draft changes are held in local React state until **Save** is pressed. Save writes the latest immutable revision to browser storage. **Reset example template**, **Undo**, and **Redo** operate on the versioned editor artifact; layout positions remain editor-only.
- The top-bar validation status groups errors and warnings. Click an issue to select its affected node and reveal the matching inline field error; graph nodes with issues also show an indicator.
- Branch nodes are no longer supported. Regular transitions are the only routing mechanism. Legacy Branch nodes are removed when a saved draft is loaded; their connected edges are removed and the first surviving regular node becomes the entry point if needed. Handoff nodes require only a handoff reason and optional context; they are terminal safety boundaries and cannot have outgoing transitions. End nodes are terminal too.
- The sidebar keeps only **Agents** active and can be collapsed locally to give the canvas more room.
- Click the agent name in the top bar to open **Agent settings** and edit the global persona. It applies by default to every node; node-specific guidance replaces it only for that node.
- Use the chevron beside the agent name to open the agent selector. Every browser-local agent appears in the menu; switching preserves the current agent's unsaved state and does not replace other agents. **Agent settings** is a separate button.
- Names are displayed as plain text in the UI. The editor converts them to backend-safe identifiers such as `choose_intent` only when storing the draft.
- Deleting a node removes it from the draft configuration, layout, inbound transitions, validation results, and current inspector selection. The entry node remains protected from deletion.
- The Copilot proposal contract and immutable operation boundary remain available for development, but suggested graph-fix preview/apply is not a completed part of this test-task demo. The top-bar **Save** action creates the next local revision. **Test call** activates and runs the current saved draft; if no active snapshot exists, the backend falls back to `backend/example_flow.json`.
- An **Unsaved** badge appears in the upper-right of the canvas while the draft differs from the saved revision.
- The validation menu and agent selector close when you click outside them or press `Escape`.

Backend code lives in `backend`. `backend/agent_builder/schema.py` defines the declarative agent contract, `backend/agent_builder/builder.py` compiles it, and `backend/bot.py` runs the voice pipeline.

The editor applies serializable actions to a local `AgentDraft`, which keeps Copilot changes on the same mutation path. Update `frontend/src/features/agent-graph/data/exampleAgent.ts` only when changing the example template. Templates live in `agentTemplates.ts`; call history lives in browser storage; backend access goes through `frontend/src/lib/agentApi.ts` rather than direct component access to backend files.

## Guided call evidence

Call history turns runtime events into plain-language steps using node titles, transition destinations, collected field names, tool results, and handoff reasons. It does not claim to contain a transcript when only trace data is available.

For a reliable demo, keep **Prosper Flow Test Agent** selected and open **Sample call · availability shown too early** in Call history. Its completed review identifies the deliberately missing verification guard. The sample is evidence for the review workflow; suggested graph-fix generation is still under development and is not part of the final test-task demo.

When a call reaches an End or Handoff node, the status panel is dismissed automatically and the complete record remains in browser-local Call history. Prosper Flow Test Agent includes one repeatable sample call when voice runtime access is unavailable.

## Validation

```bash
make frontend-typecheck
make frontend-lint
make frontend-test
make frontend-build
```

Backend installation and execution checks:

```bash
make install
make run
```

## Troubleshooting

- If `pnpm` is missing, install it with the official pnpm instructions and rerun `make frontend-install`.
- If the frontend loads but Test call fails, confirm the backend is running and that `VITE_VOICE_CLIENT_URL` points to its `/client` URL.
- If the backend exits on startup, confirm `OPENAI_API_KEY`, `OPENAI_MODEL`, and the voice-service key are present in `backend/.env`.
- If Test call reports that the control API is unavailable, confirm `make run` is still running and that port `8000` is free. The browser client remains on port `7860`.
- If a proposal is rejected, use the returned node, edge, target, property, or operation message to retry the evidence request. For example, an invalid `edgeId` reports the operation index and the available stable edge IDs; titles, function names, `None`, and array positions are never inferred. The initial AI graph-generation endpoint does not exist. Review states are explicit: `Reviewing this call…`, completed, or unavailable with a retry action.
- If dependencies appear stale, rerun `pnpm --dir frontend install` and `make install`.
