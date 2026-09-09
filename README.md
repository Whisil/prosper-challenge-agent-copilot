# Prosper Challenge — Agent Composer

Voice AI for healthcare scheduling. An agent is a **graph of nodes** (Pipecat Flows), defined declaratively as JSON and compiled into a runnable voice pipeline.

- **Phase 1** — a versioned UI to create, edit, validate, save, and test-call the node graph.
- **Phase 2 foundation** — post-call evidence review and a constrained Evidence-to-Flow Copilot boundary for future graph proposals.

```
browser mic  ->  ElevenLabs STT  ->  OpenAI LLM  ->  ElevenLabs TTS  ->  browser
```

Pipecat's dev runner ships a **prebuilt browser client**, while the frontend workspace provides the graph-building surface around it.

## Quickstart

See the [frontend engineering guide](docs/frontend-architecture.md) and [backend engineering guide](docs/backend-architecture.md) for setup, architecture, configuration, and troubleshooting. Requires **Python 3.11+**, [**uv**](https://docs.astral.sh/uv/getting-started/installation/), Node.js, and pnpm.

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

Open [http://localhost:5173](http://localhost:5173) to use the agent workspace. On a fresh browser the builder starts with a complex **Prosper Flow Test Agent** showcase graph and a small **Prosper Review Example** agent linked to the sample Call history record. The showcase demonstrates conversations, tools, ordinary transitions, handoffs, terminal outcomes, warnings, and errors; the review example keeps the suggested-fix scenario easy to understand. The builder also supports template or blank-agent onboarding, browser-local multi-agent storage, four-sided connections, local draft versions, validation, and draft-aware **Test call** execution.

The reliable demo path is the editable graph, Test call, Call history, and post-call AI review. The separate suggested-fix flow is documented below as post-submission progress. For the reviewer-oriented solution overview, see [`solution.md`](solution.md). `Ctrl+C` stops either process. Run `make help` to list all targets.

Prefer raw commands? Use:

```bash
uv sync --directory backend
uv run --directory backend python bot.py
pnpm --dir frontend install
pnpm --dir frontend dev
```

Remember to update `backend/.env` with `OPENAI_API_KEY`, `OPENAI_MODEL`, and the voice-service key. `OPENAI_MODEL` is the single backend-only model setting for call review and Copilot proposals; the frontend does not configure it. See the [backend engineering guide](docs/backend-architecture.md) for environment variables and troubleshooting.

## Layout

| Path | Responsibility |
| --- | --- |
| `backend/bot.py` | The voice pipeline (WebRTC + ElevenLabs STT/TTS + OpenAI LLM). Loads an agent JSON via `AgentBuilder` and runs it. No graph logic lives here. |
| `backend/agent_builder/` | All agent-building code. `schema.py` = the declarative `AgentConfig` / `Node` / `Edge` contract; `builder.py` = `AgentBuilder`, which loads + validates the JSON and compiles it into a Pipecat Flows graph. |
| `backend/example_flow.json` | The fallback runtime agent **as data** — a clinic scheduler used when no active draft has been submitted. |
| `frontend/` | The React agent workspace. It uses compact typed node setup, four-sided canvas connection dots, stable IDs with human-readable titles, simplified information collection, local agent and draft history, visible validation locations, collapsible navigation, onboarding templates, local call history and AI reviews, the constrained AI Evidence Board, and active draft test calls. |

Frontend ownership, state, and graph boundaries are documented in [`docs/frontend-architecture.md`](docs/frontend-architecture.md). Backend runtime, API, validation, storage, and model configuration are documented in [`docs/backend-architecture.md`](docs/backend-architecture.md). Repository contribution rules live in [`AGENTS.md`](AGENTS.md) and [`frontend/AGENTS.md`](frontend/AGENTS.md).

To run a different agent, point `AGENT_FLOW` in `bot.py` at another JSON file.

## Post-submission progress

Suggested fixes are a separate post-call workflow. From a completed call review, the user can generate a constrained patch rather than asking AI to replace the entire agent JSON. The backend receives the full document, trace, review, and exact node/edge reference indexes; it validates the typed operations and dry-runs the resulting graph. The frontend then previews the immutable draft with a clear “not applied” state.

The seeded sample call has a deterministic verification fallback when the AI request is unavailable or invalid, so the flow can be demonstrated safely. Real-call failures do not change the graph. **Accept** saves one new local revision; **Deny** discards the preview. The generic guideline Copilot remains a separate editor surface.
