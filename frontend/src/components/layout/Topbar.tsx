import { ChevronDown, Download, History, PhoneCall, Plus, Redo2, Save, Settings2, Undo2, Upload, CheckCircle2 } from "lucide-react"
import { useRef, useState, type ChangeEvent } from "react"
import { Button } from "@/components/ui/Button"
import { useClickOutside } from "@/lib/useClickOutside"
import type { AgentValidationError } from "@/features/agent-graph/model/type"
import type { AgentConfig } from "@/features/agent-graph/model/type"
import { AgentSettingsDialog } from "@/features/agent-settings/components/AgentSettingsDialog"
import { AgentCreationDialog } from "@/features/agent-settings/components/AgentCreationDialog"
import { ValidationSummary } from "./ValidationSummary"

interface TopbarProps {
  agentName: string
  persona: string
  onUpdatePersona: (persona: string) => void
  onTestCall: () => void
  isDirty: boolean
  validationErrors: AgentValidationError[]
  onSelectValidationError: (error: AgentValidationError) => void
  onSave: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onExport: () => void
  onImport: (file: File) => void
  onCreateAgent: (config: AgentConfig, brief?: string) => void
  initialSetup?: boolean
  onReset: () => void
  onOpenHistory: () => void
}

export function Topbar({ agentName, persona, onUpdatePersona, onTestCall, isDirty, validationErrors, onSelectValidationError, onSave, onUndo, onRedo, canUndo, canRedo, onExport, onImport, onCreateAgent, initialSetup = false, onReset, onOpenHistory }: TopbarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [creationOpen, setCreationOpen] = useState(initialSetup)
  const [agentMenuOpen, setAgentMenuOpen] = useState(false)
  const [validationRequest, setValidationRequest] = useState(0)
  const importInputRef = useRef<HTMLInputElement>(null)
  const agentMenuRef = useRef<HTMLDivElement>(null)
  useClickOutside(agentMenuRef, () => setAgentMenuOpen(false), agentMenuOpen)
  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) onImport(file)
    event.target.value = ""
  }

  return (
    <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-[#e5e8e4] bg-white px-7">
      <div className="flex items-center gap-3">
        <div>
          <div ref={agentMenuRef} className="relative flex items-center gap-2">
            <button type="button" className="flex items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#91a697]/40" onClick={() => setAgentMenuOpen((open) => !open)} aria-haspopup="listbox" aria-expanded={agentMenuOpen} aria-label="Choose agent" title="Choose agent">
              <h1 className="text-base font-semibold tracking-tight text-[#202923]">{agentName}</h1>
              <ChevronDown size={15} className="text-[#8f9992]" />
            </button>
            {agentMenuOpen && <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border border-[#dfe4df] bg-white p-2 shadow-[0_16px_35px_rgba(31,48,40,0.16)]" role="listbox" aria-label="Agents">
              <div className="rounded-lg bg-[#f0f3ef] px-3 py-2 text-[11px] font-semibold text-[#37413c]" role="option" aria-selected="true">{agentName}</div>
              <p className="px-3 py-3 text-[11px] leading-4 text-[#929d95]">No other agents yet.</p>
              <Button type="button" size="sm" variant="outline" className="w-full justify-center" onClick={() => { setAgentMenuOpen(false); setCreationOpen(true) }}><Plus size={13} /> Add agent</Button>
              <Button type="button" size="sm" variant="ghost" className="mt-1 w-full justify-center" onClick={() => { onReset(); setAgentMenuOpen(false) }}>Reset example template</Button>
            </div>}
          </div>
          <ValidationSummary errors={validationErrors} isDirty={isDirty} onSelectError={onSelectValidationError} openRequest={validationRequest} />
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="ghost" onClick={onUndo} disabled={!canUndo} title="Undo"><Undo2 size={14} /></Button>
        <Button size="sm" variant="ghost" onClick={onRedo} disabled={!canRedo} title="Redo"><Redo2 size={14} /></Button>
        <Button size="sm" variant="ghost" onClick={onExport} title="Export draft"><Download size={14} /></Button>
        <Button size="sm" variant="ghost" onClick={() => importInputRef.current?.click()} title="Import draft"><Upload size={14} /></Button>
        <Button size="sm" variant="ghost" onClick={() => setValidationRequest((value) => value + 1)} title="Validate draft"><CheckCircle2 size={14} /> Validate</Button>
        <Button size="sm" variant="ghost" onClick={onOpenHistory} title="Draft history"><History size={14} /></Button>
        <Button size="sm" variant={isDirty ? "outline" : "ghost"} onClick={onSave} disabled={!isDirty} title="Save draft"><Save size={14} />{isDirty ? "Save" : "Saved"}</Button>
        <Button size="sm" variant="ghost" onClick={() => { setAgentMenuOpen(false); setSettingsOpen(true) }} aria-label="Open agent settings" title="Open agent settings">
          <Settings2 size={14} />
          Agent settings
        </Button>
        <Button size="sm" variant="primary" onClick={onTestCall}>
          <PhoneCall size={14} />
          Test call
        </Button>
      </div>
      <input ref={importInputRef} className="hidden" type="file" accept="application/json" onChange={handleImport} />
      <AgentSettingsDialog open={settingsOpen} persona={persona} onOpenChange={setSettingsOpen} onSave={onUpdatePersona} />
      <AgentCreationDialog open={creationOpen} initialSetup={initialSetup} onOpenChange={setCreationOpen} onCreate={onCreateAgent} />
    </header>
  )
}
