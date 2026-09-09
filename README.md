# Prosper Challenge — Agent Composer

Voice AI for healthcare scheduling. An agent is a **graph of nodes** (Pipecat Flows), defined declaratively as JSON and compiled into a runnable voice pipeline.

- **Phase 1** — a versioned UI to create, edit, validate, save, and test-call the node graph.
- **Phase 2** — an Evidence-to-Flow Copilot that turns a flagged call into a reviewable, validated graph proposal.

```
browser mic  ->  ElevenLabs STT  ->  OpenAI LLM  ->  ElevenLabs TTS  ->  browser
```

Pipecat's dev runner ships a **prebuilt browser client**, while the frontend workspace provides the graph-building surface around it.

## Quickstart

See [`docs/development.md`](docs/development.md) for the complete FE/BE workflow. Requires **Python 3.11+**, [**uv**](https://docs.astral.sh/uv/getting-started/installation/), Node.js, and pnpm.

From the repo root, install both applications:

```bash
make install
make frontend-install
```

Start the backend in one terminal:

```bash
make run
```

Start the frontend in another:

```bash
make frontend-dev
```

Open [http://localhost:5173](http://localhost:5173) to use the agent workspace. The builder supports onboarding templates, blank-agent creation, typed nodes, local draft versions, JSON import/export, validation, and a draft-aware **Test call**. **Call history** stores local test traces and feedback, while the Evidence-to-Flow Copilot sends selected evidence to the backend AI endpoint and returns a reviewable stable-ID proposal with an optional preview call. `Ctrl+C` stops either process. Run `make help` to list all targets.

Prefer raw commands? Use:

```bash
uv sync --directory backend
uv run --directory backend python bot.py
pnpm --dir frontend install
pnpm --dir frontend dev
```

Remember to update `backend/.env` with API keys. See [`docs/development.md`](docs/development.md) for environment variables and troubleshooting.

## Layout

| Path | Responsibility |
| --- | --- |
| `backend/bot.py` | The voice pipeline (WebRTC + ElevenLabs STT/TTS + OpenAI LLM). Loads an agent JSON via `AgentBuilder` and runs it. No graph logic lives here. |
| `backend/agent_builder/` | All agent-building code. `schema.py` = the declarative `AgentConfig` / `Node` / `Edge` contract; `builder.py` = `AgentBuilder`, which loads + validates the JSON and compiles it into a Pipecat Flows graph. |
| `backend/example_flow.json` | The example agent **as data** — a clinic scheduler. The artifact the Phase 2 Composer generates/edits. |
| `frontend/` | The React agent workspace. It uses compact typed node setup, four-sided canvas connection dots, stable IDs with human-readable titles, simplified information collection, local draft history/import/export, visible validation locations, collapsible navigation, onboarding templates, local call history and feedback, the AI Evidence Board, and active/preview test calls. |

Frontend architecture and naming conventions are documented in [`docs/frontend-architecture.md`](docs/frontend-architecture.md). The end-to-end code walkthrough is in [`docs/product-code-flow.md`](docs/product-code-flow.md). Repository contribution rules live in [`AGENTS.md`](AGENTS.md) and [`frontend/AGENTS.md`](frontend/AGENTS.md).

To run a different agent, point `AGENT_FLOW` in `bot.py` at another JSON file.
