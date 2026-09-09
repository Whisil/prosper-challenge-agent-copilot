# Frontend contribution rules

These rules supplement the repository-level `AGENTS.md`.

## Structure

- Organize product code under `src/features/<feature-name>`.
- Keep reusable layout components under `src/components/layout`.
- Keep reusable visual primitives under `src/components/ui`.
- Keep feature types in that feature's `model/type.ts`.
- Keep data conversion at boundaries, such as `lib/flowAdapter.ts`; do not make UI components understand backend JSON details.

## Components and hooks

- Name components with PascalCase filenames: `AgentGraph.tsx`, `NodeInspector.tsx`, `Button.tsx`.
- Name hooks with `use` prefixes: `useAgentGraph.tsx`.
- Keep components focused and composable. Split a component when it owns separate visual or behavioral responsibilities.
- Use controlled props for reusable components and keep state at the nearest feature owner.
- Prefer local React state until shared server state or persistence is actually required.

## Styling and design system

- Use the local UI primitives before adding one-off controls.
- Keep design tokens in the global stylesheet and use utility classes for composition.
- Use `cn` for conditional class names.
- Keep accessible labels, focus states, and keyboard behavior on interactive controls.
- Do not introduce a second styling system without documenting the reason.

## Imports and validation

- Use the `@/*` alias for imports from `src`.
- Keep React Flow-specific types and mapping logic out of general-purpose components.
- Run `pnpm --dir frontend typecheck`, `pnpm --dir frontend lint`, `pnpm --dir frontend test`, and `pnpm --dir frontend build` before handoff when frontend code changes.
- Update `docs/frontend-architecture.md` whenever frontend structure, commands, or integration behavior changes. Update `docs/backend-architecture.md` when a frontend/backend boundary changes.
- In handoffs, summarize frontend changes in a short **Frontend** bullet section and keep backend changes in a separate **Backend** section, following the repository-level rule.
