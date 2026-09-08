# Development guide

This repository contains a Python voice-agent backend and a pnpm-managed React frontend. The frontend is a local editable graph workspace backed by a draft fixture; the backend provides the runnable Pipecat voice agent and browser test-call client.

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

Add the required API keys to `backend/.env`. The frontend environment file may use the default test-call URL:

```bash
VITE_VOICE_CLIENT_URL=http://localhost:7860/client
```

## Launch the backend

Run from the repository root:

```bash
make run
```

The Pipecat runner starts the voice agent and prints the browser client URL. The default is [http://localhost:7860/client](http://localhost:7860/client).

The backend loads `backend/example_flow.json`, validates the node graph, and compiles it into a Pipecat Flows graph. The backend can also be started directly:

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

The frontend's **Test call** button opens `VITE_VOICE_CLIENT_URL` in a new tab. Start the backend first if you want to place a real browser call.

## Working with the project

Frontend code lives in `frontend/src`. Product behavior is organized under `frontend/src/features`; reusable UI primitives live under `frontend/src/components/ui`. The graph fixture, backend-shaped types, editor actions, and validation are in `frontend/src/features/agent-graph`.

In the agent workspace:

- Use the graph toolbar to add a node and drag nodes to arrange the conversation.
- Select a node to edit its name, instructions, terminal state, and transitions.
- Use the transition controls to change targets, descriptions, required fields, or remove transitions.
- Use **Use as initial node** to change the conversation entry point.
- Draft changes are held in local React state and are not persisted or sent to the backend yet.
- The Test call button still opens the Pipecat browser client running the backend's static `backend/example_flow.json` flow.

Backend code lives in `backend`. `backend/agent_builder/schema.py` defines the declarative agent contract, `backend/agent_builder/builder.py` compiles it, and `backend/bot.py` runs the voice pipeline.

The editor applies serializable actions to a local `AgentDraft`, which keeps the future Copilot integration on the same mutation path. Update the temporary fixture in `frontend/src/features/agent-graph/data/exampleAgent.ts` when prototyping initial UI states. Future persistence and test-call sessions should be introduced through typed API adapters rather than direct component access to backend files.

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
- If the backend exits on startup, confirm both API keys are present in `backend/.env`.
- If dependencies appear stale, rerun `pnpm --dir frontend install` and `make install`.
