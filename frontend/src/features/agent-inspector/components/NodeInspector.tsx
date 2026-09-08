import { useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, Check, CircleHelp, GitBranch, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { FormField } from "@/components/ui/FormField"
import { Input } from "@/components/ui/Input"
import { Separator } from "@/components/ui/Separator"
import { Textarea } from "@/components/ui/Textarea"
import { InfoTooltip } from "@/components/ui/Tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select"
import type { AgentEdge, AgentNode, AgentProperty, AgentValidationError, TransitionReference } from "../../agent-graph/model/type"
import { validationErrorsForNode } from "../../agent-graph/lib/validationPresentation"
import { createDefaultAgentProperty, renameAgentProperty, setAgentPropertyRequired } from "../../agent-graph/lib/agentOperations"
import { humanizeIdentifier, toIdentifier } from "../../agent-graph/lib/identifier"

interface NodeInspectorProps {
  node: AgentNode
  initialNode: string
  validationErrors: AgentValidationError[]
  onUpdateNode: (nodeName: string, patch: Partial<AgentNode>) => void
  onDeleteNode: (nodeName: string) => void
  onUpdateEdge: (source: string, functionName: string, patch: Partial<AgentEdge>) => void
  onDeleteEdge: (source: string, functionName: string) => void
  selectedTransition?: TransitionReference
  onSelectTransition: (transition: TransitionReference) => void
}

export function NodeInspectorEmptyState() {
  return (
    <section className="flex h-full w-[380px] shrink-0 flex-col border-l border-[#e5e8e4] bg-[#fbfcfa]">
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <div className="max-w-[240px] space-y-2">
          <p className="text-sm font-semibold text-[#455249]">No node selected</p>
          <p className="text-xs leading-5 text-[#8a958d]">Select a node on the canvas to view and edit its details.</p>
        </div>
      </div>
    </section>
  )
}

function fieldError(errors: AgentValidationError[], path: string) {
  return errors.find((error) => error.path === path && error.severity === "error")?.message
}

function updateInstruction(node: AgentNode, content: string): AgentNode["task_messages"] {
  const firstMessage = node.task_messages[0] ?? { role: "developer", content: "" }
  return [{ ...firstMessage, content }, ...node.task_messages.slice(1)]
}

function PropertyEditor({ edge, edgePath, propertyName, property, errors, onUpdate }: { edge: AgentEdge; edgePath: string; propertyName: string; property: AgentProperty; errors: AgentValidationError[]; onUpdate: (patch: Partial<AgentEdge>) => void }) {
  const [nameDraft, setNameDraft] = useState(humanizeIdentifier(propertyName))
  const [nameError, setNameError] = useState<string>()
  const path = `${edgePath}.properties.${propertyName}`
  useEffect(() => setNameDraft(humanizeIdentifier(propertyName)), [propertyName])

  const commitName = () => {
    const nextName = toIdentifier(nameDraft)
    if (!nextName) return setNameError("Field name cannot be empty.")
    const renamedEdge = renameAgentProperty(edge, propertyName, nextName)
    if (!renamedEdge) return setNameError("Field names must be unique within this transition.")
    setNameError(undefined)
    if (renamedEdge !== edge) onUpdate({ properties: renamedEdge.properties, required: renamedEdge.required })
  }
  const remove = () => onUpdate({ properties: Object.fromEntries(Object.entries(edge.properties).filter(([name]) => name !== propertyName)), required: edge.required.filter((name) => name !== propertyName) })
  const updateProperty = (patch: Partial<AgentProperty>) => onUpdate({ properties: { ...edge.properties, [propertyName]: { ...property, ...patch } } })

  return (
    <div className="space-y-2 rounded-lg border border-[#e4e9e4] bg-[#fbfcfb] p-2.5">
      <div className="flex items-start gap-2">
        <FormField label="Field name" info="The JSON key sent to the agent when this transition is invoked." error={nameError ?? fieldError(errors, `${path}.name`)} className="min-w-0 flex-1"><Input value={nameDraft} onChange={(event) => { setNameDraft(event.target.value); setNameError(undefined) }} onBlur={commitName} className="h-8" /></FormField>
        <Button type="button" size="sm" variant="ghost" className="mt-5 h-8 w-8 shrink-0 p-0 text-[#a16d5a] hover:bg-[#f8eeea] hover:text-[#8c5947]" onClick={remove} title="Delete field"><Trash2 size={13} /></Button>
      </div>
      <FormField label="What to collect" info="Describe the information the agent should capture. New information is sent as text." error={fieldError(errors, `${path}.description`)}><Input value={property.description ?? ""} onChange={(event) => updateProperty({ description: event.target.value })} placeholder="What should this field contain?" className="h-8" /></FormField>
      <label className="flex items-center gap-2 text-[11px] text-[#68736c]"><input type="checkbox" checked={edge.required.includes(propertyName)} onChange={(event) => onUpdate({ required: setAgentPropertyRequired(edge, propertyName, event.target.checked).required })} /> Required field</label>
    </div>
  )
}

function TransitionEditor({ source, edge, edgeIndex, siblingEdges, errors, selected, onSelect, onUpdate, onDelete }: { source: string; edge: AgentEdge; edgeIndex: number; siblingEdges: AgentEdge[]; errors: AgentValidationError[]; selected: boolean; onSelect: () => void; onUpdate: (functionName: string, patch: Partial<AgentEdge>) => void; onDelete: () => void }) {
  const [functionDraft, setFunctionDraft] = useState(humanizeIdentifier(edge.function))
  const [functionError, setFunctionError] = useState<string>()
  const nameInputRef = useRef<HTMLInputElement>(null)
  const path = `nodes.${source}.edges.${edge.function || edgeIndex}`
  useEffect(() => setFunctionDraft(humanizeIdentifier(edge.function)), [edge.function])
  useEffect(() => { if (selected) nameInputRef.current?.focus() }, [selected])

  const commitFunction = () => {
    const nextFunction = toIdentifier(functionDraft)
    if (!nextFunction) return setFunctionError("Transition name cannot be empty.")
    if (nextFunction !== edge.function && siblingEdges.some((candidate) => candidate.function === nextFunction)) return setFunctionError("Transition names must be unique on this node.")
    setFunctionError(undefined)
    if (nextFunction !== edge.function) onUpdate(edge.function, { function: nextFunction })
  }
  const addField = () => {
    let index = Object.keys(edge.properties).length + 1
    let name = `field_${index}`
    while (edge.properties[name]) { index += 1; name = `field_${index}` }
    onUpdate(edge.function, { properties: { ...edge.properties, [name]: createDefaultAgentProperty() } })
  }

  return (
    <Card className={selected ? "space-y-3 border-[#91a697] p-3 shadow-[0_0_0_2px_rgba(109,144,120,0.12)]" : "space-y-3 p-3"} onClick={onSelect}>
      <div className="flex items-start gap-2"><FormField label="Transition name" info="The unique action name the model uses to move the conversation forward." error={functionError ?? fieldError(errors, `${path}.function`)} className="min-w-0 flex-1"><Input ref={nameInputRef} value={functionDraft} onChange={(event) => { setFunctionDraft(event.target.value); setFunctionError(undefined) }} onBlur={commitFunction} className="h-8 font-semibold" /></FormField><Button type="button" size="sm" variant="ghost" className="mt-5 h-8 w-8 shrink-0 p-0 text-[#a16d5a] hover:bg-[#f8eeea] hover:text-[#8c5947]" onClick={onDelete} title="Delete transition"><Trash2 size={13} /></Button></div>
      <FormField label="Transition path" info="Choose whether this transition is conditional, a default fallback, or the result of a tool action."><Select value={edge.kind ?? "condition"} onValueChange={(value) => onUpdate(edge.function, { kind: value as AgentEdge["kind"] })}><SelectTrigger aria-label="Transition path"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="condition">Condition</SelectItem><SelectItem value="default">Default fallback</SelectItem><SelectItem value="success">Tool success</SelectItem><SelectItem value="failure">Tool failure</SelectItem></SelectContent></Select></FormField>
      {edge.kind === "condition" && <FormField label="When this path applies" info="Describe the situation that should make the agent choose this path. Use plain language; the runtime can normalize it later."><Input value={edge.condition ?? ""} onChange={(event) => onUpdate(edge.function, { condition: event.target.value })} placeholder="e.g. The caller wants to book an appointment" /></FormField>}
      <FormField label="When to use" info="Describe the caller intent or information that should cause the model to invoke this transition." error={fieldError(errors, `${path}.description`)}><Textarea value={edge.description} onChange={(event) => onUpdate(edge.function, { description: event.target.value })} placeholder="When should the agent use this transition?" className="min-h-16" /></FormField>
      <div className="space-y-2 border-t border-[#edf0ed] pt-3"><div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><span className="text-[11px] font-semibold text-[#455249]">Information to collect</span><InfoTooltip content="These fields become structured arguments for the transition. The agent collects them before entering the connected node. Leave this section empty when no structured information is needed." /></div><Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={addField}><Plus size={12} /> Add information</Button></div><p className="text-[10px] leading-4 text-[#929d95]">Optional details the agent should capture before entering the next node.</p>{Object.entries(edge.properties).map(([propertyName, property]) => <PropertyEditor key={propertyName} edge={edge} edgePath={path} propertyName={propertyName} property={property} errors={errors} onUpdate={(patch) => onUpdate(edge.function, patch)} />)}{Object.keys(edge.properties).length === 0 && <p className="rounded-lg border border-dashed border-[#d8e0d9] px-3 py-2 text-[10px] text-[#929d95]">No structured information is collected by this transition.</p>}</div>
    </Card>
  )
}

export function NodeInspector({ node, initialNode, validationErrors, onUpdateNode, onDeleteNode, onUpdateEdge, onDeleteEdge, selectedTransition, onSelectTransition }: NodeInspectorProps) {
  const [nameDraft, setNameDraft] = useState(node.title ?? humanizeIdentifier(node.name))
  const [nameError, setNameError] = useState<string>()
  const nodeErrors = useMemo(() => validationErrorsForNode(validationErrors, node.name), [node.name, validationErrors])
  const blockingErrors = nodeErrors.filter((error) => error.severity === "error")
  const isInitial = node.name === initialNode
  useEffect(() => setNameDraft(node.title ?? humanizeIdentifier(node.name)), [node.name, node.title])

  const commitName = () => {
    const nextTitle = nameDraft.trim()
    if (!nextTitle) return setNameError("Node title cannot be empty.")
    setNameError(undefined)
    if (nextTitle !== (node.title ?? humanizeIdentifier(node.name))) onUpdateNode(node.name, { title: nextTitle })
  }
  return (
    <section className="flex h-full w-[380px] shrink-0 flex-col border-l border-[#e5e8e4] bg-[#fbfcfa]">
      <div className="border-b border-[#e5e8e4] px-5 py-4"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9aa49d]">Selected node</p><Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-[#a16d5a] hover:bg-[#f8eeea] hover:text-[#8c5947]" onClick={() => onDeleteNode(node.name)} disabled={isInitial} title={isInitial ? "The entry node cannot be deleted" : "Delete node"}><Trash2 size={13} /></Button></div><div className="mt-2 flex items-start gap-2"><FormField label="Node title" info="The readable title shown on the graph. The stable technical ID is kept separately." error={nameError ?? fieldError(validationErrors, `nodes.${node.name}.title`)} className="min-w-0 flex-1"><Input aria-label="Node title" value={nameDraft} onChange={(event) => { setNameDraft(event.target.value); setNameError(undefined) }} onBlur={commitName} className="h-9 font-semibold" /></FormField><Button type="button" size="sm" variant="secondary" className="mt-5 h-9 w-9 shrink-0 p-0" onClick={commitName} title="Apply node title"><Check size={14} /></Button></div><p className="mt-2 text-[10px] text-[#9aa49d]">Type: {node.type ?? (node.end ? "end" : "conversation")}{isInitial ? " · Entry point" : ""}</p></div>
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <div className="space-y-3"><FormField label="Task instruction" info="The instruction the voice agent follows while it is in this node." error={fieldError(validationErrors, `nodes.${node.name}.task_messages`)}><Textarea aria-label="Node instructions" value={node.task_messages[0]?.content ?? ""} onChange={(event) => onUpdateNode(node.name, { task_messages: updateInstruction(node, event.target.value) })} placeholder="Describe what the agent should do..." className="min-h-24 leading-5" /></FormField><FormField label="Node-specific guidance" info="Optional guidance that replaces the global persona while this node is active."><Textarea aria-label="Node-specific guidance" value={node.role_message ?? ""} onChange={(event) => onUpdateNode(node.name, { role_message: event.target.value || null })} placeholder="Optional node-specific guidance..." className="min-h-16" /></FormField>{node.type === "tool" && <div className="space-y-3 rounded-lg border border-[#e4e9e4] bg-[#f8faf8] p-3"><p className="text-[11px] font-semibold text-[#455249]">Mock tool</p><FormField label="Tool name" info="The deterministic tool action represented by this node."><Input value={node.tool?.name ?? ""} onChange={(event) => onUpdateNode(node.name, { tool: { name: event.target.value, description: node.tool?.description ?? "", confirmationRequired: node.tool?.confirmationRequired } })} placeholder="e.g. search_availability" /></FormField><FormField label="Tool description" info="Explain what the mock tool does and when it may be used."><Textarea value={node.tool?.description ?? ""} onChange={(event) => onUpdateNode(node.name, { tool: { name: node.tool?.name ?? "", description: event.target.value, confirmationRequired: node.tool?.confirmationRequired } })} className="min-h-16" /></FormField><label className="flex items-center gap-2 text-[11px] text-[#68736c]"><input type="checkbox" checked={node.tool?.confirmationRequired ?? false} onChange={(event) => onUpdateNode(node.name, { tool: { name: node.tool?.name ?? "", description: node.tool?.description ?? "", confirmationRequired: event.target.checked } })} /> Require confirmation before action</label></div>}{node.type === "branch" && <FormField label="Branch expression" info="A simple deterministic expression evaluated against collected conversation state."><Input value={node.branch?.expression ?? ""} onChange={(event) => onUpdateNode(node.name, { branch: { expression: event.target.value } })} placeholder="e.g. intent == book" /></FormField>}{node.type === "transfer" && <div className="space-y-3 rounded-lg border border-[#e4e9e4] bg-[#f8faf8] p-3"><FormField label="Handoff reason" info="The reason shown to the receiving team."><Input value={node.transfer?.reason ?? ""} onChange={(event) => onUpdateNode(node.name, { transfer: { reason: event.target.value, context: node.transfer?.context } })} placeholder="Why should this call be handed off?" /></FormField><FormField label="Handoff context" info="Information the receiving team should receive."><Textarea value={node.transfer?.context ?? ""} onChange={(event) => onUpdateNode(node.name, { transfer: { reason: node.transfer?.reason ?? "", context: event.target.value } })} className="min-h-16" /></FormField></div>}</div>
        <Separator />
        <div><div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2 text-xs font-semibold text-[#455249]"><GitBranch size={14} className="text-[#8b9b8f]" /> Transitions</div></div><p className="mb-3 text-[10px] leading-4 text-[#929d95]">Drag the dot on this node to connect it to another node. Configure the transition here after it exists.</p><div className="space-y-3">{node.edges.map((edge, edgeIndex) => { const transition = { source: node.name, functionName: edge.function }; return <TransitionEditor key={`${edge.function}-${edge.target}-${edgeIndex}`} source={node.name} edge={edge} edgeIndex={edgeIndex} siblingEdges={node.edges} errors={validationErrors} selected={selectedTransition?.source === transition.source && selectedTransition.functionName === transition.functionName} onSelect={() => onSelectTransition(transition)} onUpdate={(functionName, patch) => onUpdateEdge(node.name, functionName, patch)} onDelete={() => onDeleteEdge(node.name, edge.function)} /> })}{node.edges.length === 0 && <p className="text-xs text-[#8f9992]">No transitions yet. Drag the dot on this node to create one.</p>}</div></div>
        {blockingErrors.length > 0 && <div className="rounded-xl bg-[#f8eeea] p-3.5"><div className="flex gap-2"><AlertCircle size={15} className="mt-0.5 shrink-0 text-[#a16d5a]" /><div className="space-y-1">{blockingErrors.map((error) => <p className="text-[11px] leading-4 text-[#8c5947]" key={`${error.path}-${error.message}`}>{error.message}</p>)}</div></div></div>}
        <div className="rounded-xl bg-[#f0f3ef] p-3.5"><div className="flex gap-2"><CircleHelp size={15} className="mt-0.5 shrink-0 text-[#809487]" /><p className="text-[11px] leading-4 text-[#718078]">Changes are local to this draft. Copilot proposals will use the same editor actions.</p></div></div>
      </div>
    </section>
  )
}
