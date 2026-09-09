# Call feedback flow

The product uses a completed call as evidence for improving an agent. It does not store a full transcript. Instead, it keeps the call status, runtime steps, transitions, tools or handoffs, tested draft version, and the AI review.

## What happens

1. A user starts a Test call against the current saved draft.
2. The runtime records what happened as the graph runs.
3. When an End or Handoff node is reached, the call is saved to browser storage.
4. The backend reviews the completed trace and returns either a clean result or a short list of issues.
5. The result appears in Call history with a readable timeline and affected graph locations.
6. If a change is justified, **Generate suggested fix** asks the backend for a small, typed graph patch.
7. The patch is validated and shown as an unapplied preview. **Accept** saves it as a new local revision; **Deny** discards it.

The active graph is never changed automatically by a review. Call records and reviews stay in the browser, while the backend handles runtime execution and AI requests.
