import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import type { AgentConfig } from "@/features/agent-graph/model/type"
import { agentTemplates } from "@/features/agent-graph/data/agentTemplates"
import { createBlankAgent } from "@/features/agent-graph/data/createBlankAgent"

interface AgentCreationDialogProps {
  open: boolean
  initialSetup?: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (config: AgentConfig) => void
}

export function AgentCreationDialog({ open, initialSetup = false, onOpenChange, onCreate }: AgentCreationDialogProps) {
  const [templateId, setTemplateId] = useState<"scheduler" | "intake" | "test" | "blank">("scheduler")
  const [name, setName] = useState("Clinic Scheduler")
  const [persona, setPersona] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const selectedTemplate = templateId === "blank" ? agentTemplates[0] : agentTemplates.find((template) => template.id === templateId) ?? agentTemplates[0]
  const nameError = name.trim() ? undefined : "Agent name is required."

  const reset = () => {
    setTemplateId("scheduler")
    setName("Clinic Scheduler")
    setPersona("")
    setSubmitted(false)
  }
  const close = (nextOpen: boolean) => {
    if (!nextOpen) reset()
    onOpenChange(nextOpen)
  }
  const submit = () => {
    setSubmitted(true)
    if (nameError) return
    const config = templateId === "blank"
      ? createBlankAgent(name.trim(), persona.trim())
      : { ...selectedTemplate.config, name: name.trim() || selectedTemplate.name, persona: persona.trim() || selectedTemplate.config.persona }
    onCreate(config)
    close(false)
  }

  return <Dialog open={open} onOpenChange={close}><DialogContent aria-describedby="agent-creation-description" className="max-w-lg"><DialogHeader><DialogTitle>{initialSetup ? "Set up your agent" : "Create agent"}</DialogTitle><DialogDescription id="agent-creation-description">Start from a tested template or create a small blank graph. AI graph creation is coming soon.</DialogDescription></DialogHeader><div className="mt-5 space-y-4"><div className="grid gap-2 sm:grid-cols-3">{agentTemplates.map((template) => <button key={template.id} type="button" onClick={() => { setTemplateId(template.id); if (!name.trim() || name === selectedTemplate.name) setName(template.name) }} className={`rounded-xl border p-3 text-left ${template.id === templateId ? "border-[#8eaa95] bg-[#f0f5f0]" : "border-[#e2e8e2] hover:bg-[#f7faf7]"}`}><p className="text-xs font-semibold text-[#3c4a41]">{template.name}</p><p className="mt-1 text-[10px] leading-4 text-[#7d8a80]">{template.description}</p></button>)}<button type="button" onClick={() => { setTemplateId("blank"); if (!name.trim() || agentTemplates.some((template) => name === template.name)) setName("New Agent") }} className={`rounded-xl border p-3 text-left ${templateId === "blank" ? "border-[#8eaa95] bg-[#f0f5f0]" : "border-[#e2e8e2] hover:bg-[#f7faf7]"}`}><p className="text-xs font-semibold text-[#3c4a41]">Blank agent</p><p className="mt-1 text-[10px] leading-4 text-[#7d8a80]">Start with one valid entry node and add the rest manually.</p></button></div><button type="button" disabled className="flex w-full items-center justify-between rounded-xl border border-[#e2e5e2] bg-[#f4f5f3] p-3 text-left opacity-60" title="AI agent creation will be available after the builder workflow is stable."><span><span className="block text-xs font-semibold text-[#59665d]">Describe with AI</span><span className="mt-1 block text-[10px] text-[#89938c]">AI agent creation will be available after the builder workflow is stable.</span></span><span className="rounded-full bg-[#e2e7e2] px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#78847b]">Coming soon</span></button><label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-[#4a574e]">Agent name</span><Input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Agent name" aria-invalid={Boolean(submitted && nameError)} />{submitted && nameError && <span className="mt-1 block text-[10px] text-[#b56550]">{nameError}</span>}</label><label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-[#4a574e]">Global persona</span><Textarea value={persona} onChange={(event) => setPersona(event.target.value)} placeholder="Optional voice and behavior guidance..." className="min-h-20" /></label></div><DialogFooter><Button type="button" variant="ghost" onClick={() => close(false)}>Cancel</Button><Button type="button" variant="primary" onClick={() => void submit()}>Create agent</Button></DialogFooter></DialogContent></Dialog>
}
