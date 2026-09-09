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
    agent-settings/          Global persona and blank-agent creation
    agent-copilot/           Evidence Board, AI proposal contracts, and operation applier
    call-history/             Browser-local call records, AI reviews, and trace review
  lib/                       Cross-feature utilities
  styles/                    Global tokens and canvas styles
```

Components use PascalCase filenames (`AgentGraph.tsx`, `Button.tsx`). Hooks use `use` names (`useAgentGraph.tsx`). Feature-local types live in `model/type.ts`.

## Data flow

```text
AgentDocument migration/adapters
  -> AgentDraft history and serializable editor actions
  -> validateAgentConfig
  -> flowAdapter.ts
  -> React Flow nodes and edges
  -> AgentGraph canvas
  -> selected node
  -> NodeInspector edits
```

`AgentDocument` is the canonical editor artifact. It carries a version, revision, stable node/edge IDs, display titles, typed node metadata, and editor layout outside runtime semantics. `agentDocument.ts` owns migration from the legacy `AgentConfig` and conversion back to the backend-compatible runtime contract. React Flow types are kept at the graph boundary.

## Design system

The frontend uses Tailwind utilities and local shadcn-style primitives. Shared controls belong in `src/components/ui` and should be extended before a feature creates a one-off version. Design tokens and canvas-specific styles live in `src/styles/globals.css`.

The current visual direction is a calm healthcare workspace: warm off-white canvas, dark evergreen text and actions, quiet borders, and green state accents. Graph nodes use white cards with restrained shadows and readable transition labels.

Local `Select`, `Tooltip`, and `FormField` primitives follow the shadcn-style approach: Radix supplies accessible behavior and the project owns the visual styles. Use `Select` for node/property choices instead of native `<select>` elements, and use `InfoTooltip` for fields whose relationship to the backend contract is not obvious. Inputs and textareas use compact typography so the inspector remains scannable.

## Editor and validation boundary

The editor starts from `exampleAgent.ts` only when no browser agent collection exists. `agentCollection.ts` owns the browser-local list, active-agent selection, migration from the old single-draft key, and per-agent draft storage. `history.ts` owns immutable past/present/future snapshots; `draftPersistence.ts` owns local save/load. `agentOperations.ts` owns serializable mutations, while `validateAgent.ts` reports blocking errors and non-blocking warnings. The Copilot emits `GraphOperation` values using stable node and edge IDs rather than display titles or array indexes. `operationApplier.ts` validates and applies those operations immutably, and is the only proposal-to-draft boundary.

Frontend-only node positions live in `AgentDraft.layout` and are not part of the backend `AgentConfig` contract. A future API integration should replace the fixture through a service or query hook and retain `flowAdapter.ts` as the conversion boundary. Components should not import backend files directly.

The workspace has one graph-level entry point through `initial_node`. The entry node is protected from deletion and remains the entry point when renamed. Regular nodes and terminal nodes are created through separate UI actions; terminal nodes set the backend-compatible `end` flag at creation time, so multiple terminal nodes can coexist without exposing a misleading role-conversion control in the inspector.

The sidebar owns its collapsed/expanded UI state locally. Collapsing it hides navigation labels while preserving icon navigation and the active state; this state is intentionally not persisted yet. **Agents** is the only active workspace in the focused challenge scope.

## Editable graph behavior

`AgentGraph` uses controlled React Flow node state with `useNodesState` and `onNodesChange`. This keeps a node’s position and dragging state responsive under the pointer; `onNodeDragStop` is the only point that writes the final position to `AgentDraft.layout`. `AgentNode` uses a raised shadow, scale, and stacking order while dragging. The canvas itself is the node navigation surface; the separate outline is intentionally omitted.

Every node renders target handles on all four sides. Each non-terminal node also renders four reusable source connection dots; terminal nodes render no outgoing source handles. Graph cards do not render a transition footer; existing transition rows are metadata only and do not contain source handles. `AgentGraph` maps a new canvas connection to `add_edge`; it does not expose a reconnect interaction in this slice or create a second graph mutation model. React Flow edges remain a rendering projection of the backend-shaped config.

`AgentDraft.edgeHandles` stores `{ source, target }` side metadata keyed by stable edge ID. It is editor-only and defaults legacy edges to bottom-to-left. `flowAdapter` maps the metadata to React Flow handle IDs while `documentToRuntimeConfig` drops it before backend execution.

`TransitionReference` (`source` plus `functionName`) identifies an existing transition for inspector selection. Transient `ConnectionInteractionState` tracks whether the canvas is idle or creating a new transition. React Flow connection and pointer objects never enter `AgentDraft` or `AgentConfig`; connection sides are reduced to serializable metadata before the editor action is dispatched.

Transition editor fields map directly to the backend contract: name → `function`, connected node → `target`, when to use → `description`, and information to collect → `properties` plus `required`. New information items use `type: "string"` in the UI because callers naturally provide spoken text; the backend contract and validator still preserve supported `number`, `integer`, and `boolean` values for future Copilot or imported configurations. `validateAgentConfig` provides structured paths for these fields and is the source for both inline inspector errors and the top-bar summary.

The serializable `update_agent` action updates the global persona without changing graph nodes. The top-bar agent menu opens the settings dialog. The backend applies the global persona to nodes without `role_message`; node-specific guidance intentionally replaces it for a node that needs different behavior.

Default positions are produced by `graphLayout.ts`, which keeps initial, fallback, and newly created nodes separated by a shared vertical spacing constant. Dragged positions remain frontend-only in `AgentDraft.layout`.

`identifier.ts` separates presentation from persistence: `humanizeIdentifier` renders names such as `choose_intent` as `Choose Intent`, while `toIdentifier` normalizes edited names before they enter `AgentConfig`. Validation paths remain backend-safe, but user-facing locations and messages are humanized.

New-node creation calls `fitView` with the created node after React Flow mounts it, keeping the selected node visible even when it is appended below the existing graph. The agent selector and Agent settings controls are separate top-bar interactions; only the settings dialog mutates the draft in this slice.

Deletion is reducer-owned: removing a node removes its layout entry and every inbound edge. Both the inspector delete action and React Flow's keyboard `Delete` event call the same graph-hook mutation. React Flow's asynchronous `onBeforeDelete` guard rejects deletion of the graph's `initial_node`. After a successful deletion, the graph hook clears selection instead of choosing another node, and the inspector renders an empty selection state until the user selects a node.

Validation errors also carry optional structured location metadata for the node, transition, property, and field. The top-bar `ValidationSummary` groups errors and warnings, formats those locations for users, and selects the affected node when clicked. The flow adapter passes node-level issues into `AgentNode`, which displays an error or warning marker even when that node is not selected. The minimap is intentionally omitted; the canvas retains its grid, fit-view action, and zoom controls. New nodes are created through typed setup dialogs in `NodeCreationDialog`, which commit only complete required fields. Transfer setup edits handoff reason/context and creates a terminal handoff node with internal runtime instructions; regular transitions are the only routing mechanism.

The top bar exposes explicit Validate, Save, Undo, Redo, and local draft-history controls. The top-right of the canvas shows an Unsaved badge while the current draft differs from the saved revision. `TestSessionPanel` displays events returned by the local control API and dismisses itself after terminal status. There is no standalone simulator or hidden scenario runner; Copilot preview is a validated document sent to a real session-specific backend runtime.

`CopilotPanel` owns the review UI, but proposal generation crosses one explicit boundary: `createCopilotProposal` sends an `AgentDocument`, draft version, evidence text, and optional call record to `POST /api/copilot/propose`. The backend owns the OpenAI key and the single `OPENAI_MODEL` setting, and returns a constrained `ChangeProposal` JSON object, never a replacement document. Both review and proposal requests use a shared context containing the full document, node/edge reference indexes, allowed node types, and operation contract. The backend requests strict JSON Schema Structured Outputs without temperature, then validates the response and the resulting graph. Its validator allows only `conversation`, `tool`, `transfer`, and `end` nodes and the seven stable-ID graph operations. A new node may include its complete outgoing edges or receive them through `add_edge`; each edge ID can be introduced only once. Node and edge references use stable IDs; edge targets use exact runtime names; titles are display-only. The frontend treats the response as untrusted until operation and local document validation succeed.

Evidence can come from a guideline typed into the panel or from an AI review attached to a browser-local `CallRecord`. `CallHistoryWorkspace` stores the call status, runtime trace, review, agent name, and optional sample marker under `prosper-call-history-v1`; it does not store transcripts. `hasTerminalEvidence` recognizes an ended, handoff, or terminal node-entry event and reconciles the backend session before starting the single post-terminal review request. An actionable review selects its matching agent and starts proposal generation; `CopilotPanel` automatically builds a validated immutable preview while the canvas shows a loading state. Trace summaries are derived from structured payloads such as source/target titles, transition names, collected fields, tool names, and handoff reasons.

The panel presents diagnosis, confidence, assumptions, questions, risks, and stable-ID operations. The proposal contract and immutable operation boundary remain in place, but suggested graph-fix preview/apply is under development and was dropped from the final test-task demo. Initial AI graph creation is deliberately disabled in `AgentCreationDialog`; the fresh workspace starts with the single Prosper Flow Test Agent showcase, while templates and blank agents remain available for additional local agents.
