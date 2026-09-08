# Project contribution rules

Read this file before changing the repository. These rules apply to backend, frontend, documentation, and configuration work.

## Engineering principles

- Keep code DRY. Prefer a reusable abstraction when the same behavior appears more than once.
- Keep frontend and backend boundaries explicit through typed contracts, adapters, and small interfaces.
- Prefer simple implementations over speculative infrastructure.
- Organize code by feature and responsibility
- Use minimal comments for intent, trade-offs, or non-obvious constraints. Do not narrate obvious code.
- Make changes easy to review and split into logical commits.

## Naming and structure

- Use PascalCase filenames for components: `Button.tsx`, `AgentNode.tsx`, `CopilotPanel.tsx`.
- Use descriptive hook filenames such as `useAgentGraph.tsx`.
- Use `type.ts` for feature-local types and keep types close to the behavior that owns them.
- Keep shared primitives in shared component folders; keep product behavior inside feature folders.
- Do not put feature-specific logic into generic UI components.

## Documentation is part of implementation

Documentation must be updated automatically in the same logical change whenever code changes affect behavior, configuration, commands, APIs, folder structure, or developer workflow.

- Add usage instructions for new features.
- Remove or update stale commands, paths, ports, and environment variables.
- Keep `README.md` concise and link detailed operational guidance from `docs/`.
- Keep architecture documentation aligned with the actual implementation.
- Treat documentation validation as part of the definition of done; do not defer it to a later prompt.

## Validation and handoff

- Run the narrowest relevant checks first, then the project-level checks before handoff.
- Report checks that were run and any checks that could not run.
- Do not silently change unrelated user work.
- Preserve existing behavior unless the requested change explicitly replaces it.

## Commit rules

- Do not stage or commit changes automatically. Leave implementation changes in the worktree and report their status unless the user explicitly requests staging or commits.
- Split work into small, logical, sequential commits that can be reviewed or reverted independently.
- Keep each commit focused on one purpose; do not mix dependency setup, product behavior, tests, and unrelated cleanup.
- Use concise lowercase subjects in the form `<verb> <purpose>`, for example `add frontend dependencies`, `implement agent graph`, or `document local development`.
- Order commits so prerequisites come before the code that uses them, and verification/fixes follow the behavior they verify.
- Include documentation changes in the same logical commit as the behavior or workflow they describe, unless the documentation is a standalone guide.
- Run relevant checks before committing and mention the validation in the handoff.
- Never commit secrets, `.env` files, dependency directories, build output, or generated caches.
- Inspect `git diff` and `git status` before every commit to avoid including unrelated user changes.
- Do not amend, squash, or rewrite existing commits unless explicitly requested.
