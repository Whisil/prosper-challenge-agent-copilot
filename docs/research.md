# Prosper Voice Agent Challenge: Research, Strategy, and Implementation Plan

## Executive Summary

The challenge is not primarily a canvas-building exercise. It is a constrained product-design problem: turn deployment-team knowledge and production failures into safer, reviewable, testable agent changes. Phase 1 should establish a small but credible graph editor and test-call loop; Phase 2 should make the graph a derived artifact of an evidence-driven copilot rather than the main place humans author every detail.

Prosper positions itself as a healthcare voice-AI platform spanning patient access and revenue-cycle workflows: scheduling, intake, reminders, billing, benefits verification, prior authorization, claims, and payer calls. Its website emphasizes “Blueprints,” EHR/PMS write-back, end-to-end workflows, AI QA, and rapid deployment. These claims indicate that the strongest submission should optimize for deployment speed, exception handling, auditability, and measurable call outcomes—not generic chatbot creativity.[^1][^2]

The recommended demo concept is an **Evidence-to-Flow Copilot**: a user supplies a natural-language client guideline or selects a flagged call; the copilot extracts a workflow contract, proposes a graph patch, highlights uncertainty and risk, generates adversarial test scenarios, runs simulations, and presents a diff that requires human approval before publishing. This directly targets both manual workflows in the prompt while preserving deterministic control over healthcare actions.

## What the Challenge Actually Tests

The repository already separates the declarative agent artifact from runtime execution. Pipecat Flows models conversations as graphs whose nodes focus the LLM on a single task and whose transitions manage context and tools. This architecture is explicitly intended for precise control, complex tasks, and improved accuracy over monolithic prompts.[^3][^4]

The practical task therefore has three layers:

1. **Authoring:** create and edit a structured agent graph.
2. **Execution:** run that artifact through the existing browser voice pipeline.
3. **Improvement:** convert guidelines, call outcomes, and human feedback into safe changes.

A weak solution treats layer one as the product. A strong solution demonstrates the closed loop across all three layers: define, test, observe, diagnose, patch, replay, and publish.

The challenge wording also signals pragmatic scoping. Reviewers will value judgment more than breadth, so a small number of well-designed node types, mocked integrations, and a compelling feedback loop are preferable to an unfinished “platform.” The demo should make the deployment engineer’s work visibly shorter and safer.

## Prosper Context and Product Implications

Prosper describes itself as handling both patient and payer calls across the patient journey. The official site highlights natural speech, mid-call topic changes, scheduling, intake, refills, billing questions, benefits, prior authorization, payer IVR navigation, and EHR/PMS integration.[^1]

The site also emphasizes Blueprints: pre-trained or battle-tested workflow foundations that can be tailored to a client. It claims AI-powered quality assurance on every call, API-first integrations, and a roughly three-week launch motion.[^1]

This suggests the deployment bottleneck is unlikely to be merely writing prompts. It is likely the translation of organization-specific policies into executable behavior, validating integrations and edge cases, and continuously reviewing exceptions. The submission should therefore show:

- Policy-to-workflow translation.
- Explicit data and tool contracts.
- Human approval around risky changes.
- Regression tests generated from failures.
- Evidence that a change improves task completion without creating new safety failures.

Prosper’s marketing claims should not be treated as independently verified benchmarks; they are useful product-positioning signals. For the challenge, frame metrics as proposed evaluation targets rather than promises.

## Phase 1: Voice Agent Builder

### Core product model

Use a graph model with a small, typed vocabulary:

| Element | Recommended meaning | Why it matters |
|---|---|---|
| Conversation node | Multi-turn dialogue for one bounded objective | Keeps prompts focused and editable |
| Tool node | Deterministic API action such as search availability or book appointment | Separates side effects from free-form generation |
| Branch node | Rule or classifier split on structured state | Makes routing inspectable |
| Transfer node | Human handoff with reason and context | Required for exceptions and safety |
| End node | Explicit completion or failure | Prevents ambiguous endings |
| Edge | Condition, default fallback, or tool success/failure path | Makes transitions reviewable |
| Shared/global handler | Human request, emergency cue, verification failure, language change | Avoids duplicating universal escape paths |

Retell’s current conversation-flow model is a useful industry comparison: it separates conversation, subagent, function, logic, transfer, and end nodes, and supports condition-based, default, and dynamic transitions.  ElevenLabs similarly exposes graph workflows, subagent nodes, tool nodes with success/failure paths, transfers, end nodes, and analytics over node entries and edge distributions.[^5][^6][^7]

Pipecat Flows itself defines node properties such as role message, task messages, functions, pre-actions, post-actions, context strategy, and immediate response behavior. The builder should expose only the subset that is necessary for the demo and keep the raw JSON accessible for transparency.[^3]

### Recommended Phase 1 UI

Use a three-pane layout:

- **Left:** node palette, flow outline, validation status, and “Copilot” entry points.
- **Center:** React Flow-style canvas with pan, zoom, minimap, selectable nodes, handles, edge labels, and a visible start node.
- **Right:** node/edge inspector with typed fields, prompt editor, tool parameters, transition condition, fallback setting, and test examples.

Add a compact top bar containing agent name, draft/published status, undo/redo, validate, simulate, and test call. A bottom drawer can show validation errors, generated tests, call traces, and the current artifact diff.

The UI should support at least:

- Create an agent from a scheduling template.
- Add, delete, duplicate, move, and connect nodes.
- Edit node fields and edge conditions.
- Select a node from a list and focus the canvas on it.
- Validate unreachable nodes, missing start node, cycles without exit policy, missing fallback edges, dangling edges, duplicate IDs, invalid tool schemas, and unsafe actions without confirmation.
- Save/load JSON and export a readable artifact.
- Launch the existing browser test call with the active draft.

Do not build a general-purpose workflow IDE. Avoid advanced collaborative editing, arbitrary code execution nodes, full RBAC, multi-tenant persistence, production telephony, or a complete EHR integration in an 8–12 hour challenge.

### Phase 1 architecture

Keep the canonical artifact versioned and typed. A practical shape is:

```json
{
  "version": 1,
  "metadata": {"name": "Clinic Scheduler", "language": "en-US"},
  "globals": {"human_handoff": true, "max_verification_attempts": 2},
  "nodes": [
    {
      "id": "collect_intent",
      "type": "conversation",
      "title": "Understand request",
      "instructions": "Identify booking, rescheduling, cancellation, or other request.",
      "variables": ["intent"],
      "examples": []
    }
  ],
  "edges": [
    {"id": "e1", "from": "collect_intent", "to": "booking", "kind": "condition", "condition": "Caller wants to book an appointment"},
    {"id": "fallback", "from": "collect_intent", "to": "handoff", "kind": "default"}
  ]
}
```

Use schema validation at every boundary. Keep node IDs stable so traces, regression cases, and diffs survive renames. Store positions as editor metadata rather than mixing layout concerns into runtime semantics.

The backend can continue compiling into Pipecat Flows. Pipecat’s graph abstraction keeps conversation logic separate from the STT–LLM–TTS pipeline, which is exactly the separation needed for a fast challenge implementation.[^4]

### Test-call UX

A test call is necessary but not sufficient. Before the call, display the selected draft version and a warning if validation fails. During the call, show connection state, elapsed time, mute/end controls, and optionally the current node. Afterward, show a lightweight trace: transcript, node path, tool calls, transition decisions, duration, and final outcome.

Even if the starter runner provides a browser client, add a small wrapper around it so the user can answer “which version did I just test?” and “where did it fail?” Avoid claiming that a test call proves correctness; it validates audio experience but is poor at regression coverage.

## Phase 2: Agent Copilot

### The central idea

Build the copilot as a **change-management system for conversational workflows**, not as a chat box that writes prompts. Its output should be a structured proposal with evidence, graph operations, risk annotations, generated tests, and an approval decision.

A useful mental model is:

`Guideline or call issue -> workflow contract -> graph patch -> adversarial tests -> simulation -> human review -> published version -> production evidence`

This borrows the strongest idea from coding agents—inspect the current artifact, propose a patch, run tests, show a diff—but adapts it to voice and healthcare. OpenAI’s Agents documentation similarly separates agent orchestration, tools, guardrails, human review, tracing, and evaluation; these are the right conceptual boundaries even if the challenge implementation remains custom.[^8]

### A novel interaction: the Evidence Board

Use a two-column Copilot workspace:

- **Evidence column:** client guideline, flagged call excerpt, transcript, structured issue, affected node, relevant policy, and confidence.
- **Change column:** proposed graph patch, generated tests, risk level, expected behavior, and before/after trace.

The copilot should never silently replace the graph. It should produce actions such as:

- Add a verification node before appointment disclosure.
- Add a fallback edge after two failed attempts.
- Narrow the booking tool schema to approved appointment types.
- Add a transfer path when the caller mentions an out-of-scope clinical concern.
- Add a regression case from this call.
- Change a static sentence while preserving all transitions.

Each proposal should be individually accepted, rejected, or edited. This is more defensible than accepting a large generated JSON blob.

### Two copilot entry points

#### Create from guidelines

The user pastes instructions such as: “For new patients, collect name, date of birth, preferred location, provider type, and insurance. Do not disclose appointment details until identity is verified. If the caller reports urgent symptoms, transfer to staff. If no suitable slot exists, offer a waitlist.”

The copilot returns:

1. Extracted intents.
2. Required variables and data types.
3. Tools and their input/output contracts.
4. Conversation phases.
5. Safety and escalation rules.
6. Proposed graph.
7. Ambiguities requiring answers.
8. Generated test scenarios.

The key design choice is to show ambiguity instead of inventing policy. For example: “What counts as urgent?” and “May the agent offer any provider or only the caller’s requested provider?” should become blocking questions or explicitly marked assumptions.

#### Iterate from production feedback

The user chooses a mocked issue such as: “The agent offered an appointment before verifying identity,” “It looped after the patient said they wanted a human,” or “It booked the wrong appointment type.”

The copilot inspects the trace and graph, classifies the failure, proposes the smallest safe patch, and creates a regression test. The patch should include a causal explanation: missing guard, ambiguous edge, tool result not checked, or fallback absent.

### Proposed copilot pipeline

1. **Ingest:** accept text guidelines, transcript, structured feedback, or a selected trace.
2. **Normalize:** convert input into a workflow contract with goals, variables, policies, tools, outcomes, and escalation requirements.
3. **Inspect:** retrieve the active graph, schema, node IDs, tool definitions, prior tests, and relevant traces.
4. **Diagnose:** identify the likely failure point and distinguish prompt, transition, tool, data, integration, and policy failures.
5. **Plan:** generate a minimal set of typed graph operations rather than free-form JSON.
6. **Check:** run static validation and policy checks.
7. **Generate tests:** create happy-path, edge-case, adversarial, and regression scenarios.
8. **Simulate:** run text-based conversations against the draft, with optional mocked tools.
9. **Compare:** evaluate outcome, path, tool arguments, policy compliance, latency proxy, and fallback behavior.
10. **Review:** show diff, evidence, tests, risks, assumptions, and expected impact.
11. **Publish:** create a new immutable version only after approval.
12. **Learn:** store accepted/rejected proposals and failures as future examples.

The flow mirrors established agent-observability practice: trace complete runs, inspect representative failures, annotate them, turn failures into regression datasets, run controlled experiments, and monitor production.[^9][^10]

### Data model for copilot proposals

```ts
type ChangeProposal = {
  id: string;
  baseVersion: string;
  source: { kind: "guideline" | "call" | "feedback"; text: string; traceId?: string };
  diagnosis: { category: string; explanation: string; confidence: number };
  operations: GraphOperation[];
  assumptions: string[];
  risks: { severity: "low" | "medium" | "high"; reason: string }[];
  tests: TestCase[];
  status: "draft" | "approved" | "rejected" | "published";
};

type GraphOperation =
  | { op: "add_node"; node: Node }
  | { op: "update_node"; nodeId: string; patch: Partial<Node> }
  | { op: "add_edge"; edge: Edge }
  | { op: "update_edge"; edgeId: string; patch: Partial<Edge> }
  | { op: "remove_edge"; edgeId: string };
```

Patch operations make review and rollback possible. They also allow the copilot to say “no graph change required; integration returned stale availability” rather than forcing every issue into prompt edits.

## Industry Approaches and Trade-offs

| Approach | Strengths | Weaknesses | Best use in challenge |
|---|---|---|---|
| Single prompt agent | Fast initial setup; flexible language | Hidden state, weak predictability, difficult debugging | Use only for a simple prototype or within a bounded node |
| Explicit graph flow | Inspectable transitions; deterministic tool points; easier regression testing | More authoring effort; graph complexity can grow | Recommended foundation |
| Multi-agent handoffs | Separates specialist instructions and tools; useful for distinct domains | Handoff latency, context loss, orchestration complexity | Mock one transfer/handoff pattern, do not build a fleet |
| Tool-first deterministic workflow | Strong side-effect safety and typed contracts | Less natural if overused; requires integration design | Recommended for scheduling, verification, booking, transfer |
| LLM-based edge conditions | Handles varied language; quick to configure | Nondeterminism and evaluation cost | Use for semantic intent edges, always provide fallback |
| Expression/rule edges | Fast, reproducible, auditable | Requires structured state; brittle if upstream extraction fails | Use for verified variables and tool results |
| Full visual IDE | Powerful and extensible | Consumes time; distracts from copilot | Avoid in challenge |
| Copilot-generated full graph | Fast from prose | Large diffs, hallucinated policy, hard review | Avoid; generate typed patches |
| Copilot-generated minimal patch | Reviewable, reversible, measurable | Requires a schema and diagnosis layer | Recommended |
| Human-in-the-loop publishing | Safer and builds trust | Slower than full autonomy | Essential for healthcare-sensitive changes |
| Autonomous production mutation | Potentially fast | Unsafe, hard to attribute, high blast radius | Do not implement |
| Mocked tools/data | Enables demo and deterministic tests | Can conceal integration failures | Use clearly labeled mocks with failure modes |
| Real EHR integration | Demonstrates end-to-end value | Scope, credentials, PHI, and compliance burden | Do not attempt in challenge |

Retell explicitly positions structured flow agents as preferable for complex, high-stakes calls, while single-prompt agents are fastest for simple linear conversations.  ElevenLabs provides a similar node graph with API/CLI JSON representation and node-level configuration.[^11][^12][^5]

LiveKit’s workflow guidance offers another useful distinction: persistent agents, short-lived tasks, tools, handoffs, and task groups should be used for different lifecycles; context should be preserved where continuity matters and reset where a clean slate improves safety.[^13]

## Healthcare and Safety Requirements

The challenge is a demo, not a compliance certification, but healthcare context should shape product decisions. HHS says the HIPAA Security Rule requires reasonable and appropriate administrative, physical, and technical safeguards for electronic protected health information and that business-associate arrangements are required when a business associate creates, receives, maintains, or transmits ePHI.[^14]

For a challenge implementation:

- Use synthetic data only; never paste real patient data into external models.
- Label all data and integrations as mock/demo.
- Keep patient identity, appointment details, and clinical content separate in the schema.
- Verify identity before disclosing appointment information.
- Make scheduling tools typed and narrow: search availability, hold slot, confirm booking, cancel booking.
- Require confirmation before irreversible writes.
- Add human transfer for uncertainty, failed verification, emergency cues, clinical questions, and repeated misunderstanding.
- Avoid clinical advice and avoid collecting unnecessary medical narratives.
- Keep audit events for graph edits, proposal decisions, tool calls, and publication.
- Do not call the demo HIPAA-compliant; say that production deployment would require vendor contracts, security controls, data governance, and organizational review.

NIST’s GenAI profile organizes risk management around identifying and managing risks unique to or amplified by generative AI. The challenge’s copilot should operationalize that by exposing assumptions, provenance, confidence, and approval state rather than hiding them.[^15][^16]

Prompt injection and excessive agency are particularly relevant to a copilot that can modify workflows or call tools. The safest design is to constrain the copilot to typed graph operations, validate all outputs, isolate untrusted transcripts from system instructions, and deny direct access to production credentials. The 2026 OWASP material is a useful current warning that prompt injection, sensitive-information disclosure, and excessive agency remain central risks for tool-connected LLM systems.[^17][^18]

## Evaluation Strategy

A successful demo should evaluate more than whether the agent sounds natural. Use a small, explicit scorecard:

| Dimension | Example measure |
|---|---|
| Task outcome | Appointment booked, rescheduled, cancelled, or correctly escalated |
| Path correctness | Required verification and consent occurred before disclosure/action |
| Tool correctness | Correct tool, arguments, ordering, and handling of failures |
| Recovery | Caller correction, interruption, ambiguity, and “human” request handled |
| Safety | No unsupported clinical advice or unauthorized disclosure |
| Efficiency | Turns, tool calls, time-to-completion proxy |
| Maintainability | Small patch, clear node ownership, regression coverage |
| Trust | Reviewer can understand why the proposal was made |

Retell’s testing model is a strong product reference: manual text playground, AI simulation, batch test cases, browser audio tests, and real phone tests serve different stages.  ElevenLabs also documents simulated conversations and using underperforming histories to create test prompts and evaluation criteria.[^19][^20]

For the challenge, implement deterministic checks where possible and LLM-as-judge only for semantic criteria. Do not present an LLM score as ground truth. Show the transcript, expected outcome, actual path, and failed assertion.

A compelling mocked regression set might include:

- New patient requests an appointment.
- Existing patient reschedules.
- Caller fails identity verification twice.
- No suitable slot exists; offer waitlist.
- Caller changes topic mid-call.
- Caller asks for a human.
- Caller mentions a potentially urgent symptom.
- Booking API fails or returns stale availability.
- Caller attempts to access another person’s appointment.

## What Absolutely Not to Do

### Product mistakes

- Build a beautiful canvas with no meaningful copilot loop.
- Treat the copilot as a generic chat panel that writes opaque JSON.
- Generate a complete graph on every request instead of proposing minimal changes.
- Hide uncertainty or invent missing healthcare policy.
- Make every node a prompt node and every edge an LLM condition.
- Omit default/fallback paths.
- Let the agent book, cancel, disclose, or transfer without typed tool contracts and explicit outcomes.
- Use a single giant prompt to handle scheduling, billing, verification, emergencies, and handoff.
- Build production telephony, real EHR integration, authentication, billing, or collaboration for this time box.
- Claim HIPAA compliance based on a demo stack.

### Engineering mistakes

- Store positions and runtime semantics in one unversioned blob.
- Use unstable node IDs, making traces and patches impossible to correlate.
- Permit arbitrary code execution from generated agent configuration.
- Accept LLM-generated JSON without schema validation.
- Allow the copilot to mutate the live agent without draft/version/rollback.
- Build only happy-path mocks; include tool timeouts, empty results, malformed results, and transfer failures.
- Depend on one live API call for the entire demo; provide deterministic fallback fixtures.
- Make the test call the only testing mechanism.
- Log full sensitive transcripts by default in a real deployment; minimize and govern retained data.

### Demo mistakes

- Start with architecture slides instead of a visible user problem.
- Spend ten minutes dragging nodes before showing the copilot.
- Present unsupported performance claims.
- Demo an AI change without showing the before/after trace and regression test.
- Fail to explain what was intentionally mocked or omitted.
- Make the reviewer wonder whether the proposal can be safely rejected.

## Recommended Demo Narrative

1. Open a scheduling agent with a compact graph and a few realistic nodes.
2. Place a browser test call and show the current node/path and outcome.
3. Open a flagged call: “Agent offered slots before verification.”
4. Let the copilot inspect the trace and identify the missing guard.
5. Show a minimal patch: insert verification before availability disclosure and add a failed-verification transfer path.
6. Show generated regression tests, including an adversarial identity-mismatch scenario.
7. Run before/after simulations and show the failed assertion disappearing without breaking normal booking.
8. Approve and publish a new version; show immutable version history.
9. Paste a second natural-language guideline and show the contract-to-flow generation, with an ambiguity question rather than invented behavior.
10. End with the real test call against the approved draft.

The demo should communicate that the graph is not merely edited; it is continuously improved through evidence.

## Small Implementation Plan with AI Agents

The implementation plan should remain intentionally short. Use coding agents for bounded workstreams with explicit acceptance criteria and review after each milestone.

### Phase 0: Reconnaissance

1. Ask an AI coding agent to inspect the repository, identify runtime entrypoints, schema, builder, environment variables, and browser test-call behavior.
2. Ask it to produce a dependency map and a minimal-change plan; do not let it rewrite backend behavior yet.
3. Manually run the starter pipeline and record the current agent behavior.

### Phase 1: Builder

1. Have one agent create the typed frontend model, sample scheduling graph, and validation functions.
2. Have another implement the canvas and inspector using the existing frontend stack or the smallest compatible addition.
3. Have a separate pass implement save/load, draft versions, JSON export, and backend flow-file selection.
4. Add a test-call wrapper and a trace panel with mocked or backend-emitted events.
5. Run an AI-assisted review focused on malformed graphs, unsafe transitions, race conditions, and missing fallbacks.

### Phase 2: Copilot

1. Implement a contract extractor that returns structured intents, variables, tools, policies, assumptions, and questions.
2. Implement graph operations and a patch applier; prohibit raw graph replacement.
3. Implement a diagnosis prompt that receives only the relevant graph, trace, and policy context.
4. Implement test generation with fixed scenario schemas and deterministic tool fixtures.
5. Implement static validation and semantic evaluation.
6. Implement proposal review with diff, risk labels, assumptions, accept/reject per operation, and publish-to-new-version.
7. Seed three mocked production issues and at least six regression cases.
8. Add a scripted demo mode so the main story works even if external APIs are slow or unavailable.

### Final hardening

1. Ask an AI agent to attack the copilot with prompt injection, hidden instructions in transcripts, malformed JSON, missing tool results, and unauthorized actions.
2. Ask another to act as a deployment engineer and identify where the UI still creates work.
3. Manually simplify anything that does not strengthen the demo narrative.
4. Write `solution.md` with decisions, trade-offs, mocked boundaries, known limitations, and a five-minute walkthrough.

## Suggested `solution.md` Positioning

The document should state that the submission intentionally optimizes for deployment-team leverage rather than builder breadth. Explain that the canonical source is a versioned typed graph; the copilot produces reviewable patches; simulations and regression cases protect against regressions; and human approval is required before publication.

Document these trade-offs explicitly:

- Pipecat Flows retained to reduce runtime risk and honor the starter architecture.
- React Flow-style graph editor chosen for speed and inspectability rather than custom canvas work.
- Mock scheduling tools chosen to keep the demo deterministic and avoid PHI/integration scope.
- Text simulation added because real audio calls are slow and insufficient for regression testing.
- LLM conditions allowed only where semantic interpretation is useful; structured state and rules control side effects.
- Full autonomy rejected because healthcare workflow changes need review, evidence, and rollback.

The strongest final sentence is not “the AI builds agents.” It is closer to: **“Every production issue becomes an explainable graph patch and a regression test, so deployment teams improve agents without repeatedly rebuilding them by hand.”**