# Call feedback flow

This product treats a completed call as evidence about the agent's graph. The evidence is intentionally small: it contains runtime steps, transitions, tool or handoff events, the tested draft version, and an AI review. It is not a transcript and it is not a permanent training dataset.

## The complete flow

```text
Test call
  -> terminal graph event
  -> save CallRecord locally
  -> create ImprovementRecord
  -> review the call with AI
  -> update the ImprovementRecord
  -> optionally generate a typed graph proposal
  -> preview and validate the proposal
  -> accept or deny
  -> record the decision for later context
```

The terminal event is an End or Handoff node. It is the point at which the frontend treats the call as complete, even if the runtime session status is updated a little later. The completed call is saved before the review request starts, so a failed AI request never loses the call evidence.

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
  ]
}
```

The timeline turns these technical event kinds into readable steps. For example, `book_appointment` is displayed as **Book Appointment used**, and the transition explains that the caller moved from **Caller Request** to **Share Availability**.

The trace can show what the graph did, but it cannot reliably prove every sentence spoken by the caller. The system therefore avoids claiming that it has a full transcript.

## AI call review

After the call is saved, the frontend sends `POST /api/copilot/review-call`. The request contains:

- The complete `AgentDocument` that was tested.
- The call's complete trace and status.
- The draft version.
- Compact historical findings for the same agent, if any.

The backend builds a prompt with the current graph, its stable node and edge reference index, and the trace as untrusted evidence. The AI returns a small structured review:

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
      "edgeId": "request_to_availability"
    }
  ],
  "recommendedAction": "propose_changes"
}
```

The review is stored with the call. It is also copied into the compact improvement memory described below. If the backend or model is unavailable, the call is kept and the review is marked unavailable with an actionable error and retry option.

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

The selected call is different: its full trace is sent because it is the evidence currently being reviewed. Earlier calls are sent only as compact summaries. The prompt labels that history as untrusted and potentially stale, while the current graph's reference index remains authoritative.

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

Transcript capture with privacy controls, human correction of inaccurate reviews, shared evidence storage, larger deterministic replay suites, and full-agent rebuild proposals are intentionally deferred. The current memory layer is context for review; it is not model training or automatic learning.
