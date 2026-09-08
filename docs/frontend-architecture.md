# Frontend architecture

## Folder structure

```text
frontend/src/
  app/                       Application composition and shell
  components/
    layout/                  Shared navigation and workspace layout
    ui/                      Reusable design-system primitives
  features/
    agent-graph/             Graph model, fixture, actions, validation, adapter, and canvas
    agent-inspector/         Selected-node editor and transition controls
    agent-copilot/           Copilot prompt and suggestion surface
  lib/                       Cross-feature utilities
  styles/                    Global tokens and canvas styles
```

Components use PascalCase filenames (`AgentGraph.tsx`, `Button.tsx`). Hooks use `use` names (`useAgentGraph.tsx`). Feature-local types live in `model/type.ts`.

## Data flow

```text
AgentConfig fixture
  -> AgentDraft reducer and serializable editor actions
  -> validateAgentConfig
  -> flowAdapter.ts
  -> React Flow nodes and edges
  -> AgentGraph canvas
  -> selected node
  -> NodeInspector edits
```

`AgentConfig`, `AgentNode`, and `AgentEdge` mirror the backend contract in `backend/agent_builder/schema.py`. React Flow types are kept at the graph boundary so the rest of the feature works with agent-domain types.

## Design system

The frontend uses Tailwind utilities and local shadcn-style primitives. Shared controls belong in `src/components/ui` and should be extended before a feature creates a one-off version. Design tokens and canvas-specific styles live in `src/styles/globals.css`.

The current visual direction is a calm healthcare workspace: warm off-white canvas, dark evergreen text and actions, quiet borders, and green state accents. Graph nodes use white cards with restrained shadows and readable transition labels.

## Editor and validation boundary

The editor is fixture-driven and local. `exampleAgent.ts` is intentionally temporary and has the same shape as the backend JSON. `agentOperations.ts` owns serializable mutations, while `validateAgent.ts` reports blocking errors and non-blocking warnings. The future Copilot should emit these same actions rather than directly rewriting JSON.

Frontend-only node positions live in `AgentDraft.layout` and are not part of the backend `AgentConfig` contract. A future API integration should replace the fixture through a service or query hook and retain `flowAdapter.ts` as the conversion boundary. Components should not import backend files directly.
