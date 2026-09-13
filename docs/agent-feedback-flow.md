# Agent and feedback flow

Prosper has two connected parts: a visual graph that controls the agent, and a small evidence loop that helps improve it.

## 1. Build the agent

An agent is a JSON document represented in the editor as a graph.

- A conversation node tells the agent what to say or collect.
- A tool node performs a configured mock action.
- A transition describes when the agent may move to another node.
- An End node completes the call.
- A Handoff node stops automation and sends the caller to staff.

The graph is edited in the browser. Node positions and connection-handle sides are editor data; node names, edge IDs, properties, and required fields are the runtime contract. Validation runs as the graph changes. A draft must be saved before it becomes the active version used by a test call.

The starter scheduling flows keep appointment choices explicit. For example, the agent may offer “Tomorrow at 10 AM” and “Next Monday at 2 PM,” while the transition accepts only those configured values. An unoffered request such as Wednesday is blocked instead of being sent to the booking path.

## 2. Run a call

When Test call is selected, the frontend validates the current draft, activates it through the local control API, creates a session, and opens the Pipecat voice client.

During the call, the backend records:

- Nodes entered and transitions used.
- Tool calls and mock results.
- Handoffs and terminal outcomes.
- Bounded user and assistant transcript turns.

The call ends when an End or Handoff node is reached, or when the voice session disconnects. The completed session is saved in browser storage before any AI review starts.

## 3. Review the evidence

Call history keeps the graph trace and conversation transcript separate:

- The trace says what the workflow executed.
- The transcript says what the caller and agent actually said.

The reviewer receives the current graph, the selected call’s full bounded trace and transcript, and compact summaries of earlier reviewed calls for the same agent. It checks verification, offered times, confirmation, tool success, safe routing, and whether the result matches the graph.

A call can be:

- **Looks good** — the available evidence supports the expected behavior.
- **Needs attention** — the trace or transcript shows a concrete issue.
- **Review unavailable** — the transcript or AI service was unavailable, so the product does not pretend to know whether the conversation was correct.

Review-unavailable calls remain retryable. They are not treated as “No change” and are not used as historical findings.

## 4. Improve the graph

For a graph-related issue, the review can offer Generate suggested fix. This is a separate post-call flow:

```text
completed call → AI review → typed graph patch → immutable preview → Accept or Deny
```

The AI receives the complete current graph and exact stable node and edge references. It returns a small list of allowed operations, not a replacement JSON document. The backend validates every reference, applies the operations to a copy, and validates the resulting graph.

The frontend then shows the changed graph as **Suggested changes · not applied**. New nodes can be moved in the preview before acceptance. Accept saves one new local revision. Deny discards the preview and leaves the real draft unchanged. A stale preview cannot be accepted after the user edits or switches the underlying agent.

Runtime defects use a different path. For example, if a mock tool reports success but the configured success transition cannot run, the call is marked as a technical issue and offers Report technical issue. It does not ask AI to patch a problem caused by the runtime itself.

## 5. Remember earlier improvements

Each completed call creates a compact improvement-memory record for its agent. It stores the outcome, review summary, affected IDs, decision, draft version, and accepted changes. It does not store another graph copy or a transcript.

Later reviews receive up to the latest 20 useful summaries for that agent. Accepted changes are shown so the reviewer does not casually suggest reversing a resolved safety fix. Rejected proposals remain context, but they do not permanently forbid future changes. The current graph and selected call always have priority over historical context.

This is contextual evidence, not automatic model training. A person still reviews and accepts every graph change.

## 6. Local boundaries

Agents, drafts, revisions, calls, transcripts, and improvement memory are stored locally in the browser for this challenge. Runtime sessions and AI requests are handled by the local backend. No production scheduling database is connected, so availability is deliberately mock data and must be configured in the graph.

Future work could add transcript privacy controls, shared storage, stronger replay tests, human correction of reviews, live availability integrations, and full-agent rebuilds. Those are outside the current submission.

## Quick test

1. Start the backend with `make run` and the frontend with `make frontend-dev`.
2. Open the app and select the scheduling showcase.
3. Run a normal call using one of the offered times.
4. Run another call and try Wednesday; verify that the transition is blocked.
5. Open Call history and wait for the AI review.
6. Inspect the transcript, trace, and review status.
7. If the review identifies a graph issue, generate a suggested fix.
8. Move the preview node if needed, then Accept to save or Deny to discard.
