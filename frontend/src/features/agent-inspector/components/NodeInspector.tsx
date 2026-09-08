import { useEffect, useMemo, useState } from "react"
import { AlertCircle, Check, CircleHelp, FileText, GitBranch, Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Separator } from "@/components/ui/Separator"
import { Textarea } from "@/components/ui/Textarea"
import type { AgentEdge, AgentNode, AgentValidationError } from "../../agent-graph/model/type"

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

function updateInstruction(node: AgentNode, content: string): AgentNode["task_messages"] {
  const firstMessage = node.task_messages[0] ?? { role: "developer", content: "" }
  return [{ ...firstMessage, content }, ...node.task_messages.slice(1)]
}

export function NodeInspector({ node, nodes, initialNode, validationErrors, onUpdateNode, onDeleteNode, onSetInitialNode, onAddEdge, onUpdateEdge, onDeleteEdge }: NodeInspectorProps) {
  const [nameDraft, setNameDraft] = useState(node.name)
  const nodeErrors = useMemo(() => validationErrors.filter((error) => error.path.startsWith(`nodes.${node.name}`)), [node.name, validationErrors])
  const blockingErrors = nodeErrors.filter((error) => error.severity === "error")
  const isInitial = node.name === initialNode

  useEffect(() => setNameDraft(node.name), [node.name])

  const commitName = () => {
    const nextName = nameDraft.trim()
    if (nextName && !nodes.some((candidate) => candidate.name === nextName && candidate.name !== node.name)) {
      onUpdateNode(node.name, { name: nextName })
    }
  }

  const addTransition = () => {
    let index = node.edges.length + 1
    let functionName = `new_transition_${index}`
    while (node.edges.some((edge) => edge.function === functionName)) {
      index += 1
      functionName = `new_transition_${index}`
    }
    const target = nodes.find((candidate) => candidate.name !== node.name)?.name ?? node.name
    onAddEdge(node.name, { function: functionName, description: "", target, properties: {}, required: [] })
  }

  return (
    <section className="flex h-full w-[300px] shrink-0 flex-col border-l border-[#e5e8e4] bg-[#fbfcfa]">
      <div className="border-b border-[#e5e8e4] px-5 py-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9aa49d]">Selected node</p>
        <div className="mt-2 flex items-center gap-2">
          <Input aria-label="Node name" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} onBlur={commitName} className="h-9 text-sm font-semibold capitalize" />
          <Button size="sm" variant="secondary" className="h-9 w-9 shrink-0 p-0" onClick={commitName} title="Apply node name"><Check size={14} /></Button>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <Badge className={node.end ? "bg-[#f3ece8] text-[#976c59]" : "bg-[#e9f0ea] text-[#5e8068]"}>{node.end ? "Terminal" : "Conversation step"}</Badge>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[#a16d5a] hover:bg-[#f8eeea] hover:text-[#8c5947]" onClick={() => onDeleteNode(node.name)} disabled={isInitial} title={isInitial ? "The initial node cannot be deleted" : "Delete node"}><Trash2 size={13} /></Button>
        </div>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#455249]"><FileText size={14} className="text-[#8b9b8f]" /> Instructions</div>
          <Textarea aria-label="Node instructions" value={node.task_messages[0]?.content ?? ""} onChange={(event) => onUpdateNode(node.name, { task_messages: updateInstruction(node, event.target.value) })} placeholder="Describe what the agent should do..." className="text-xs leading-5" />
          <label className="mt-3 flex items-center gap-2 text-xs text-[#68736c]"><input type="checkbox" checked={node.end ?? false} onChange={(event) => onUpdateNode(node.name, { end: event.target.checked })} /> End conversation after this node</label>
          {!isInitial && <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => onSetInitialNode(node.name)}>Use as initial node</Button>}
        </div>
        <Separator />
        <div>
          <div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2 text-xs font-semibold text-[#455249]"><GitBranch size={14} className="text-[#8b9b8f]" /> Transitions</div><Button size="sm" variant="ghost" className="h-7 px-2" onClick={addTransition} title="Add transition"><Plus size={13} /></Button></div>
          <div className="space-y-3">
            {node.edges.map((edge) => (
              <Card className="space-y-2 p-3" key={edge.function}>
                <div className="flex items-center justify-between gap-2"><Input aria-label="Transition function" value={edge.function} onChange={(event) => onUpdateEdge(node.name, edge.function, { function: event.target.value })} className="h-8 text-xs font-semibold" /><Button size="sm" variant="ghost" className="h-7 w-7 shrink-0 p-0 text-[#a16d5a] hover:bg-[#f8eeea] hover:text-[#8c5947]" onClick={() => onDeleteEdge(node.name, edge.function)} title="Delete transition"><Trash2 size={13} /></Button></div>
                <select aria-label="Transition target" value={edge.target} onChange={(event) => onUpdateEdge(node.name, edge.function, { target: event.target.value })} className="h-8 w-full rounded-lg border border-[#dfe4df] bg-white px-2 text-xs text-[#68736c] outline-none focus:border-[#91a697]">
                  {nodes.map((candidate) => <option key={candidate.name} value={candidate.name}>{candidate.name.replaceAll("_", " ")}</option>)}
                </select>
                <Input aria-label="Transition description" value={edge.description} onChange={(event) => onUpdateEdge(node.name, edge.function, { description: event.target.value })} placeholder="When should this transition run?" className="h-8 text-xs" />
                <Input aria-label="Required fields" value={edge.required.join(", ")} onChange={(event) => onUpdateEdge(node.name, edge.function, { required: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} placeholder="Required fields, comma separated" className="h-8 text-xs" />
              </Card>
            ))}
            {node.edges.length === 0 && <p className="text-xs text-[#8f9992]">No transitions yet. Add one to continue the conversation.</p>}
          </div>
        </div>
        {blockingErrors.length > 0 && <div className="rounded-xl bg-[#f8eeea] p-3.5"><div className="flex gap-2"><AlertCircle size={15} className="mt-0.5 shrink-0 text-[#a16d5a]" /><div className="space-y-1">{blockingErrors.map((error) => <p className="text-[11px] leading-4 text-[#8c5947]" key={`${error.path}-${error.message}`}>{error.message}</p>)}</div></div></div>}
        <div className="rounded-xl bg-[#f0f3ef] p-3.5"><div className="flex gap-2"><CircleHelp size={15} className="mt-0.5 shrink-0 text-[#809487]" /><p className="text-[11px] leading-4 text-[#718078]">Changes are local to this draft. Copilot proposals will use the same editor actions.</p></div></div>
      </div>
    </section>
  )
}
