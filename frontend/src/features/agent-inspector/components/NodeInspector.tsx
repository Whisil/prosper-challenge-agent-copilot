import { useEffect, useMemo, useState } from "react"
import { AlertCircle, Check, CircleHelp, GitBranch, Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { FormField } from "@/components/ui/FormField"
import { Input } from "@/components/ui/Input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select"
import { Separator } from "@/components/ui/Separator"
import { Textarea } from "@/components/ui/Textarea"
import { supportedPropertyTypes, type AgentEdge, type AgentNode, type AgentProperty, type AgentValidationError } from "../../agent-graph/model/type"

interface NodeInspectorProps {
  node: AgentNode
  nodes: AgentNode[]
  initialNode: string
  validationErrors: AgentValidationError[]
  onUpdateNode: (nodeName: string, patch: Partial<AgentNode>) => void
  onDeleteNode: (nodeName: string) => void
  onSetInitialNode: (nodeName: string) => void
  onAddEdge: (source: string, edge: AgentEdge) => void
  onUpdateEdge: (source: string, functionName: string, patch: Partial<AgentEdge>) => void
  onDeleteEdge: (source: string, functionName: string) => void
}

function fieldError(errors: AgentValidationError[], path: string) {
  return errors.find((error) => error.path === path && error.severity === "error")?.message
}

function updateInstruction(node: AgentNode, content: string): AgentNode["task_messages"] {
  const firstMessage = node.task_messages[0] ?? { role: "developer", content: "" }
  return [{ ...firstMessage, content }, ...node.task_messages.slice(1)]
}

function PropertyEditor({ edge, edgePath, propertyName, property, errors, onUpdate }: { edge: AgentEdge; edgePath: string; propertyName: string; property: AgentProperty; errors: AgentValidationError[]; onUpdate: (patch: Partial<AgentEdge>) => void }) {
  const [nameDraft, setNameDraft] = useState(propertyName)
  const [nameError, setNameError] = useState<string>()
  const path = `${edgePath}.properties.${propertyName}`
  useEffect(() => setNameDraft(propertyName), [propertyName])

  const commitName = () => {
    const nextName = nameDraft.trim()
    if (!nextName) return setNameError("Field name cannot be empty.")
    if (nextName !== propertyName && edge.properties[nextName]) return setNameError("Field names must be unique within this transition.")
    setNameError(undefined)
    if (nextName === propertyName) return
    const properties = Object.fromEntries(Object.entries(edge.properties).map(([name, value]) => [name === propertyName ? nextName : name, value]))
    onUpdate({ properties, required: edge.required.map((name) => name === propertyName ? nextName : name) })
  }
  const remove = () => onUpdate({ properties: Object.fromEntries(Object.entries(edge.properties).filter(([name]) => name !== propertyName)), required: edge.required.filter((name) => name !== propertyName) })
  const updateProperty = (patch: Partial<AgentProperty>) => onUpdate({ properties: { ...edge.properties, [propertyName]: { ...property, ...patch } } })

  return (
    <div className="space-y-2 rounded-lg border border-[#e4e9e4] bg-[#fbfcfb] p-2.5">
      <div className="flex items-start gap-2">
        <FormField label="Field name" info="The JSON key sent to the agent when this transition is invoked." error={nameError ?? fieldError(errors, `${path}.name`)} className="min-w-0 flex-1"><Input value={nameDraft} onChange={(event) => { setNameDraft(event.target.value); setNameError(undefined) }} onBlur={commitName} className="h-8" /></FormField>
        <Button type="button" size="sm" variant="ghost" className="mt-5 h-8 w-8 shrink-0 p-0 text-[#a16d5a] hover:bg-[#f8eeea] hover:text-[#8c5947]" onClick={remove} title="Delete field"><Trash2 size={13} /></Button>
      </div>
      <FormField label="Field type" info="The value type the model should collect." error={fieldError(errors, `${path}.type`)}><Select value={property.type} onValueChange={(type) => updateProperty({ type })}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{supportedPropertyTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></FormField>
      <FormField label="Description" info="Tell the model what information belongs in this field." error={fieldError(errors, `${path}.description`)}><Input value={property.description ?? ""} onChange={(event) => updateProperty({ description: event.target.value })} placeholder="What should this field contain?" className="h-8" /></FormField>
      <label className="flex items-center gap-2 text-[11px] text-[#68736c]"><input type="checkbox" checked={edge.required.includes(propertyName)} onChange={(event) => onUpdate({ required: event.target.checked ? [...edge.required, propertyName] : edge.required.filter((name) => name !== propertyName) })} /> Required field</label>
    </div>
  )
}

function TransitionEditor({ source, edge, edgeIndex, nodes, siblingEdges, errors, onUpdate, onDelete }: { source: string; edge: AgentEdge; edgeIndex: number; nodes: AgentNode[]; siblingEdges: AgentEdge[]; errors: AgentValidationError[]; onUpdate: (functionName: string, patch: Partial<AgentEdge>) => void; onDelete: () => void }) {
  const [functionDraft, setFunctionDraft] = useState(edge.function)
  const [functionError, setFunctionError] = useState<string>()
  const path = `nodes.${source}.edges.${edge.function || edgeIndex}`
  useEffect(() => setFunctionDraft(edge.function), [edge.function])

  const commitFunction = () => {
    const nextFunction = functionDraft.trim()
    if (!nextFunction) return setFunctionError("Transition name cannot be empty.")
    if (nextFunction !== edge.function && siblingEdges.some((candidate) => candidate.function === nextFunction)) return setFunctionError("Transition names must be unique on this node.")
    setFunctionError(undefined)
    if (nextFunction !== edge.function) onUpdate(edge.function, { function: nextFunction })
  }
  const addField = () => {
    let index = Object.keys(edge.properties).length + 1
    let name = `field_${index}`
    while (edge.properties[name]) { index += 1; name = `field_${index}` }
    onUpdate(edge.function, { properties: { ...edge.properties, [name]: { type: "string", description: "" } } })
  }

  return (
    <Card className="space-y-3 p-3">
      <div className="flex items-start gap-2"><FormField label="Transition name" info="The unique action name the model uses to move the conversation forward." error={functionError ?? fieldError(errors, `${path}.function`)} className="min-w-0 flex-1"><Input value={functionDraft} onChange={(event) => { setFunctionDraft(event.target.value); setFunctionError(undefined) }} onBlur={commitFunction} className="h-8 font-semibold" /></FormField><Button type="button" size="sm" variant="ghost" className="mt-5 h-8 w-8 shrink-0 p-0 text-[#a16d5a] hover:bg-[#f8eeea] hover:text-[#8c5947]" onClick={onDelete} title="Delete transition"><Trash2 size={13} /></Button></div>
      <FormField label="Next node" info="The conversation node entered after the agent invokes this transition." error={fieldError(errors, `${path}.target`)}><Select value={nodes.some((candidate) => candidate.name === edge.target) ? edge.target : undefined} onValueChange={(target) => onUpdate(edge.function, { target })}><SelectTrigger className="h-8"><SelectValue placeholder="Choose a node" /></SelectTrigger><SelectContent>{nodes.map((candidate) => <SelectItem key={candidate.name} value={candidate.name}>{candidate.name}</SelectItem>)}</SelectContent></Select></FormField>
      <FormField label="When to use" info="Describe the caller intent or information that should cause the model to invoke this transition." error={fieldError(errors, `${path}.description`)}><Textarea value={edge.description} onChange={(event) => onUpdate(edge.function, { description: event.target.value })} placeholder="When should the agent use this transition?" className="min-h-16" /></FormField>
      <div className="space-y-2 border-t border-[#edf0ed] pt-3"><div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><span className="text-[11px] font-semibold text-[#455249]">Fields to collect</span><span title="Fields become structured arguments for this transition"><CircleHelp size={13} className="text-[#9aa49d]" /></span></div><Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={addField}><Plus size={12} /> Add field</Button></div><p className="text-[10px] leading-4 text-[#929d95]">Add information the agent needs before entering the next node.</p>{Object.entries(edge.properties).map(([propertyName, property]) => <PropertyEditor key={propertyName} edge={edge} edgePath={path} propertyName={propertyName} property={property} errors={errors} onUpdate={(patch) => onUpdate(edge.function, patch)} />)}{Object.keys(edge.properties).length === 0 && <p className="rounded-lg border border-dashed border-[#d8e0d9] px-3 py-2 text-[10px] text-[#929d95]">No fields collected by this transition.</p>}</div>
    </Card>
  )
}

export function NodeInspector({ node, nodes, initialNode, validationErrors, onUpdateNode, onDeleteNode, onSetInitialNode, onAddEdge, onUpdateEdge, onDeleteEdge }: NodeInspectorProps) {
  const [nameDraft, setNameDraft] = useState(node.name)
  const [nameError, setNameError] = useState<string>()
  const nodeErrors = useMemo(() => validationErrors.filter((error) => error.path.startsWith(`nodes.${node.name}`)), [node.name, validationErrors])
  const blockingErrors = nodeErrors.filter((error) => error.severity === "error")
  const isInitial = node.name === initialNode
  useEffect(() => setNameDraft(node.name), [node.name])

  const commitName = () => {
    const nextName = nameDraft.trim()
    if (!nextName) return setNameError("Node name cannot be empty.")
    if (nextName !== node.name && nodes.some((candidate) => candidate.name === nextName)) return setNameError("Node names must be unique.")
    setNameError(undefined)
    if (nextName !== node.name) onUpdateNode(node.name, { name: nextName })
  }
  const addTransition = () => {
    let index = node.edges.length + 1
    let functionName = `new_transition_${index}`
    while (node.edges.some((edge) => edge.function === functionName)) { index += 1; functionName = `new_transition_${index}` }
    const target = nodes.find((candidate) => candidate.name !== node.name)?.name ?? node.name
    onAddEdge(node.name, { function: functionName, description: "", target, properties: {}, required: [] })
  }

  return (
    <section className="flex h-full w-[380px] shrink-0 flex-col border-l border-[#e5e8e4] bg-[#fbfcfa]">
      <div className="border-b border-[#e5e8e4] px-5 py-5"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9aa49d]">Selected node</p><div className="mt-2 flex items-start gap-2"><FormField label="Node name" info="The stable identity of this conversation node. It is not the node type." error={nameError ?? fieldError(validationErrors, `nodes.${node.name}.name`)} className="min-w-0 flex-1"><Input aria-label="Node name" value={nameDraft} onChange={(event) => { setNameDraft(event.target.value); setNameError(undefined) }} onBlur={commitName} className="h-9 font-semibold" /></FormField><Button type="button" size="sm" variant="secondary" className="mt-5 h-9 w-9 shrink-0 p-0" onClick={commitName} title="Apply node name"><Check size={14} /></Button></div><div className="mt-3 flex items-center justify-between"><div className="flex gap-1.5"><Badge className={isInitial ? "bg-[#e9f0ea] text-[#5e8068]" : "bg-[#f0f3ef] text-[#687a6e]"}>{isInitial ? "Entry point" : "Conversation node"}</Badge>{node.end && <Badge className="bg-[#f3ece8] text-[#976c59]">Terminal</Badge>}</div><Button size="sm" variant="ghost" className="h-7 px-2 text-[#a16d5a] hover:bg-[#f8eeea] hover:text-[#8c5947]" onClick={() => onDeleteNode(node.name)} disabled={isInitial} title={isInitial ? "The initial node cannot be deleted" : "Delete node"}><Trash2 size={13} /></Button></div></div>
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <div className="space-y-3"><FormField label="Task instruction" info="The instruction the voice agent follows while it is in this node." error={fieldError(validationErrors, `nodes.${node.name}.task_messages`)}><Textarea aria-label="Node instructions" value={node.task_messages[0]?.content ?? ""} onChange={(event) => onUpdateNode(node.name, { task_messages: updateInstruction(node, event.target.value) })} placeholder="Describe what the agent should do..." className="min-h-24 leading-5" /></FormField><FormField label="Role-message override" info="Optional system-style guidance used only while this node is active."><Textarea aria-label="Role message" value={node.role_message ?? ""} onChange={(event) => onUpdateNode(node.name, { role_message: event.target.value || null })} placeholder="Optional node-specific guidance..." className="min-h-16" /></FormField><label className="flex items-center gap-2 text-[11px] text-[#68736c]"><input type="checkbox" checked={node.end ?? false} onChange={(event) => onUpdateNode(node.name, { end: event.target.checked })} /> End conversation after this node</label>{!isInitial && <Button size="sm" variant="outline" className="w-full" onClick={() => onSetInitialNode(node.name)}>Use as entry point</Button>}</div>
        <Separator />
        <div><div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2 text-xs font-semibold text-[#455249]"><GitBranch size={14} className="text-[#8b9b8f]" /> Transitions</div><Button size="sm" variant="ghost" className="h-7 px-2" onClick={addTransition} title="Add transition"><Plus size={13} /> Add</Button></div><p className="mb-3 text-[10px] leading-4 text-[#929d95]">Transitions are actions the model can invoke to move from this node to the next one.</p><div className="space-y-3">{node.edges.map((edge, edgeIndex) => <TransitionEditor key={`${edge.function}-${edge.target}-${edgeIndex}`} source={node.name} edge={edge} edgeIndex={edgeIndex} nodes={nodes} siblingEdges={node.edges} errors={validationErrors} onUpdate={(functionName, patch) => onUpdateEdge(node.name, functionName, patch)} onDelete={() => onDeleteEdge(node.name, edge.function)} />)}{node.edges.length === 0 && <p className="text-xs text-[#8f9992]">No transitions yet. Add one to continue the conversation.</p>}</div></div>
        {blockingErrors.length > 0 && <div className="rounded-xl bg-[#f8eeea] p-3.5"><div className="flex gap-2"><AlertCircle size={15} className="mt-0.5 shrink-0 text-[#a16d5a]" /><div className="space-y-1">{blockingErrors.map((error) => <p className="text-[11px] leading-4 text-[#8c5947]" key={`${error.path}-${error.message}`}>{error.message}</p>)}</div></div></div>}
        <div className="rounded-xl bg-[#f0f3ef] p-3.5"><div className="flex gap-2"><CircleHelp size={15} className="mt-0.5 shrink-0 text-[#809487]" /><p className="text-[11px] leading-4 text-[#718078]">Changes are local to this draft. Copilot proposals will use the same editor actions.</p></div></div>
      </div>
    </section>
  )
}
