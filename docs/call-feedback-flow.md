# Call feedback flow

This product treats a completed call as evidence about the agent's graph and conversation. The browser stores a small local record containing runtime steps, a bounded transcript, tool or handoff events, the tested draft version, and an AI review. It is not a transcript warehouse or a training dataset.

## The complete flow

```text
Test call
  -> terminal graph event
  -> wait briefly for the final turn snapshot
  -> save CallRecord locally
  -> create ImprovementRecord
  -> review the call with AI
  -> update the ImprovementRecord
  -> optionally generate a typed graph proposal
  -> preview and validate the proposal
  -> accept or deny
  -> record the decision for later context
```

The terminal event is an End or Handoff node. It is the point at which the frontend treats the call as complete, even if the runtime session status is updated a little later. The frontend waits two seconds for the final assistant turn, saves the completed call before requesting a review, and keeps the review retryable if the backend or model is unavailable.

## What is collected

Each call is stored in the browser as a `CallRecord` under `prosper-call-history-v1`. A simplified record looks like this:

```json
{
  "id": "session-123",
  "agentId": "agent_abc",
  "agentName": "Prosper Flow Test Agent",
  "draftVersion": "agent_abc-v3",
  "status": "completed",
  "startedAt": "2026-09-13T10:00:00Z",
  "endedAt": "2026-09-13T10:01:10Z",
  "events": [
    {
      "kind": "node_entered",
      "nodeId": "caller_request",
      "payload": { "nodeTitle": "Caller Request" }
    },
    {
      "kind": "transition",
      "edgeId": "request_to_availability",
      "payload": {
        "sourceTitle": "Caller Request",
        "transitionName": "book_appointment",
        "targetTitle": "Share Availability"
      }
    },
    {
      "kind": "ended",
      "nodeId": "booking_complete",
      "payload": { "nodeTitle": "Booking Complete", "isTerminal": true }
    }
  ],
  "transcript": [
    {
      "id": "turn-1",
      "role": "user",
      "text": "I need to book an appointment.",
      "timestamp": "2026-09-13T10:00:18Z"
    },
    {
      "id": "turn-2",
      "role": "assistant",
      "text": "Here are two appointment options.",
      "timestamp": "2026-09-13T10:00:22Z"
    }
  ]
}
```

The timeline turns these technical event kinds into readable steps. For example, `book_appointment` is displayed as **Book Appointment used**, and the transition explains that the caller moved from **Caller Request** to **Share Availability**.

The backend captures assistant turns when the assistant aggregator finishes and captures user turns from Pipecat's `on_user_turn_message_added` event, after the finalized user message has been written to the shared context. This is more reliable than treating `on_user_turn_stopped` as the transcript event because that stop event can arrive without text while realtime speech processing is still completing. Structured message parts are normalized into text. If a transport does not expose the browser session ID, the runtime resolves the newest control session before recording the turn; the final LLM context is also used as a small deduplicating recovery snapshot when a disconnect races the last turn event. A call is capped at 120 turns and 24,000 characters; `transcriptTruncated` makes shortened evidence visible. Older calls may have no transcript and are labelled trace-only. The trace explains what the graph executed; the transcript explains what was said.

A trace-only call is limited evidence. It can show that a route ran, but it cannot prove that the caller gave valid identity information, chose an offered time, or confirmed an appointment. For that reason, the reviewer cannot return **Looks good** for a trace-only or incomplete call; it is shown as **Review unavailable** with a retryable explanation instead.

## Runtime defects

Mock tool completion is deterministic. On entry to a configured tool node, the runtime records the result and immediately follows its configured success or failure transition. If there is no matching outcome transition, the session fails safely and records a `runtime_defect`. This is a platform problem, not an AI graph suggestion: Call history offers **Report technical issue**, which saves a compact local developer report with the session ID, draft version, and relevant event kinds.

## AI call review

After the call is saved, the frontend sends `POST /api/copilot/review-call`. The request contains:

- The complete `AgentDocument` that was tested.
- The call's bounded trace, transcript, and status.
- The draft version.
- Compact historical findings for the same agent, if any.

The backend builds a prompt with the current graph, its stable node and edge reference index, and the call evidence wrapped as untrusted content. The reviewer checks mixed requests, verification, offered appointment times, confirmation, tool results, handoffs, and whether the outcome matches the graph. Each issue can point to transcript turns and records observed versus expected behavior. The AI returns a small structured review:

```json
{
  "status": "needs_attention",
  "summary": "Availability was shared before identity verification.",
  "issues": [
    {
      "title": "Verification was skipped",
      "explanation": "The booking transition reaches Share Availability directly.",
      "severity": "high",
      "nodeId": "share_availability",
      "edgeId": "request_to_availability",
      "evidenceTurnIds": ["turn-1", "turn-2"],
      "observedBehavior": "Availability was shared before verification.",
      "expectedBehavior": "Verify the caller before sharing appointment options."
    }
  ],
  "recommendedAction": "propose_changes"
}
```

The review is stored with the call. It is also copied into the compact improvement memory described below. If the backend or model is unavailable, the call is kept and the review is marked unavailable with an actionable error and retry option. Unavailable or still-pending records are not sent as historical findings to later Copilot requests, so they cannot be mistaken for evidence or a no-change decision.

Built-in agents that still contain the retired task-queue nodes are restored to the current templates during migration. Custom agents are never rewritten by this migration.

## Cross-call improvement memory

Each terminal completed or failed call creates one `ImprovementRecord` in `prosper-improvement-memory-v1`. It stores only the information needed to understand prior decisions:

```json
{
  "id": "improvement_session-123",
  "agentId": "agent_abc",
  "callId": "session-123",
  "draftVersion": "agent_abc-v3",
  "outcome": "completed",
  "summary": "Availability was shared before identity verification.",
  "reviewStatus": "needs_attention",
  "issues": [
    { "title": "Verification was skipped", "severity": "high", "edgeId": "request_to_availability" }
  ],
  "decision": "accepted",
  "appliedVersion": "agent_abc-v4",
  "acceptedChanges": [
    {
      "kind": "updated_edge",
      "id": "request_to_availability",
      "beforeTarget": "share_availability",
      "afterTarget": "verify_identity"
    }
  ]
}
```

The memory is deliberately not a history of complete graphs. It does not duplicate documents, store transcripts, or create a separate workflow engine. It keeps at most 20 recent records in the browser. Records are isolated by `agentId`; a different agent's findings are not sent as context.

The selected call is different: its full bounded trace and transcript are sent because it is the evidence currently being reviewed. Earlier calls are sent only as compact summaries. The prompt labels that history as untrusted and potentially stale, while the current graph's reference index remains authoritative.

The AI is told to:

- Preserve accepted safety changes.
- Notice recurring findings without treating one event as proof of a trend.
- Treat rejected proposals as declined approaches, not permanent prohibitions.
- Return no change when another modification is not justified.
- Ask a question instead of inventing missing policy.

There is also a small deterministic conflict check. For example, if an accepted fix changed `request_to_availability` from `share_availability` to `verify_identity`, a later proposal trying to change that edge back to `share_availability` is rejected for review. A legitimate follow-up change on the same node or edge is still allowed.

## Suggested changes

When a review recommends an improvement, the user can generate a suggestion. This is a proposal, not an automatic edit.

The frontend sends `POST /api/copilot/suggest-fix` with the current document, completed call, review, draft version, and compact history. The backend returns typed operations such as:

```json
[
  {
    "op": "add_node",
    "node": {
      "id": "verify_identity",
      "name": "verify_identity",
      "title": "Verify Identity",
      "type": "conversation",
      "end": false,
      "task_messages": [
        { "role": "developer", "content": "Verify the caller before sharing availability." }
      ],
      "edges": [
        {
          "id": "verification_to_availability",
          "function": "verification_passed",
          "description": "Use after the caller passes identity verification.",
          "target": "share_availability",
          "properties": {},
          "required": [],
          "kind": "success"
        }
      ]
    }
  },
  {
    "op": "update_edge",
    "edgeId": "request_to_availability",
    "patch": { "target": "verify_identity" }
  }
]
```

The references have different purposes:

- `nodeId` and `sourceNodeId` refer to stable node IDs.
- `edgeId` refers to a stable edge ID.
- An edge `target` refers to the exact runtime node `name`.
- A node `title` is display text only and is never a graph reference.

The backend rejects unknown IDs, duplicate edge IDs, terminal outgoing edges, unsupported fields, invalid properties, protected entry-node deletion, and invalid resulting graphs. It applies operations to a copy and validates the complete result. The active draft is not changed by the request.

The frontend then applies the same operations to a cloned `AgentDraft`, preserving layout and edge-handle metadata. The preview is marked as unapplied. Accepting it updates the local graph and creates one new revision; denying it leaves the graph and revision unchanged. Accepted or rejected decisions are still written to improvement memory.

For the seeded sample availability issue, a deterministic fallback can create the verification patch if the AI is unavailable. Real-call failures fail safely without changing the graph.

## Future improvements

Multi-intent task orchestration within one call, persistent caller task state, live scheduling and availability integrations, stronger deterministic replay suites, transcript privacy controls, human correction of inaccurate reviews, shared evidence storage, and full-agent rebuild proposals are intentionally deferred. The current memory layer is context for review; it is not model training or automatic learning.
