import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog"
import { FormField } from "@/components/ui/FormField"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import type { AgentConfig } from "@/features/agent-graph/model/type"
import { createBlankAgent } from "@/features/agent-graph/data/createBlankAgent"
import { agentTemplates } from "@/features/agent-graph/data/agentTemplates"

interface AgentCreationDialogProps {
  open: boolean
  initialSetup?: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (config: AgentConfig, brief?: string) => void
}

export function AgentCreationDialog({ open, initialSetup = false, onOpenChange, onCreate }: AgentCreationDialogProps) {
  const [mode, setMode] = useState<"template" | "brief">("template")
  const [templateId, setTemplateId] = useState<"scheduler" | "intake">("scheduler")
  const [name, setName] = useState("Clinic Scheduler")
  const [persona, setPersona] = useState("")
  const [brief, setBrief] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const selectedTemplate = agentTemplates.find((template) => template.id === templateId) ?? agentTemplates[0]
  const nameError = name.trim() ? undefined : "Agent name is required."
  const briefError = mode === "brief" && !brief.trim() ? "Describe what the agent should do." : undefined

  const reset = () => {
    setMode("template")
    setTemplateId("scheduler")
    setName("Clinic Scheduler")
    setPersona("")
    setBrief("")
    setSubmitted(false)
  }
  const close = (nextOpen: boolean) => {
    if (!nextOpen) reset()
    onOpenChange(nextOpen)
  }
  const submit = () => {
    setSubmitted(true)
    if (nameError || briefError) return
    if (mode === "brief") {
      onCreate(createBlankAgent(name, persona), brief.trim())
    } else {
      onCreate({ ...selectedTemplate.config, name: name.trim() || selectedTemplate.name, persona: persona.trim() || selectedTemplate.config.persona }, undefined)
    }
    close(false)
  }

  return <Dialog open={open} onOpenChange={close}><DialogContent aria-describedby="agent-creation-description" className="max-w-lg"><DialogHeader><DialogTitle>{initialSetup ? "Set up your agent" : "Create agent"}</DialogTitle><DialogDescription id="agent-creation-description">Start from a focused healthcare workflow or describe the behavior you want Copilot to propose.</DialogDescription></DialogHeader><div className="mt-5 space-y-4"><div className="grid grid-cols-2 gap-2"><Button type="button" size="sm" variant={mode === "template" ? "outline" : "ghost"} onClick={() => setMode("template")}>Use a template</Button><Button type="button" size="sm" variant={mode === "brief" ? "outline" : "ghost"} onClick={() => setMode("brief")}>Describe your agent</Button></div>{mode === "template" ? <div className="grid gap-2 sm:grid-cols-2">{agentTemplates.map((template) => <button key={template.id} type="button" onClick={() => { setTemplateId(template.id); if (!name.trim() || name === selectedTemplate.name) setName(template.name) }} className={`rounded-xl border p-3 text-left ${template.id === templateId ? "border-[#8eaa95] bg-[#f0f5f0]" : "border-[#e2e8e2] hover:bg-[#f7faf7]"}`}><p className="text-xs font-semibold text-[#3c4a41]">{template.name}</p><p className="mt-1 text-[10px] leading-4 text-[#7d8a80]">{template.description}</p></button>)}</div> : <FormField label="What should this agent do?" info="Copilot will turn this brief into a reviewable graph proposal. It will not change the graph automatically." error={submitted ? briefError : undefined}><Textarea value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="e.g. Help patients schedule appointments, verify identity first, and transfer urgent requests to staff." className="min-h-24" /></FormField>}<FormField label="Agent name" error={submitted ? nameError : undefined}><Input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={selectedTemplate.name} /></FormField><FormField label="Global persona" info="This guidance applies to every node unless a node-specific override is provided."><Textarea value={persona} onChange={(event) => setPersona(event.target.value)} placeholder="Optional voice and behavior guidance..." className="min-h-20" /></FormField></div><DialogFooter><Button type="button" variant="ghost" onClick={() => close(false)}>Cancel</Button><Button type="button" variant="primary" onClick={submit}>{mode === "brief" ? "Create and review" : "Create agent"}</Button></DialogFooter></DialogContent></Dialog>
}
