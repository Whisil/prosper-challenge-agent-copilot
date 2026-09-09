import { useEffect, useState } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog"
import { FormField } from "@/components/ui/FormField"
import { Textarea } from "@/components/ui/Textarea"

interface AgentSettingsDialogProps {
  open: boolean
  persona: string
  canDelete: boolean
  onOpenChange: (open: boolean) => void
  onSave: (persona: string) => void
  onDelete: () => void
}

export function AgentSettingsDialog({ open, persona, canDelete, onOpenChange, onSave, onDelete }: AgentSettingsDialogProps) {
  const [personaDraft, setPersonaDraft] = useState(persona)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (open) {
      setPersonaDraft(persona)
      setConfirmDelete(false)
    }
  }, [open, persona])

  const save = () => {
    onSave(personaDraft.trim())
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="agent-settings-description">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-[#27312c]">Agent settings</DialogTitle>
          <DialogDescription id="agent-settings-description" className="text-xs leading-5 text-[#8c968f]">Set the default behavior and voice-agent guidance for this agent.</DialogDescription>
        </DialogHeader>
        <div className="mt-5 space-y-4">
          <FormField label="Global persona" info="This guidance is applied to every node unless that node has its own node-specific guidance.">
            <Textarea autoFocus value={personaDraft} onChange={(event) => setPersonaDraft(event.target.value)} placeholder="Describe how the agent should behave..." className="min-h-32" />
          </FormField>
          <p className="rounded-lg border border-[#dfe8df] bg-[#f0f5f0] px-3 py-2 text-[11px] leading-4 text-[#66806d]">A node-specific guidance message replaces this persona only while that node is active.</p>
          <div className="border-t border-[#e5e9e5] pt-4">
            {confirmDelete ? <div className="rounded-lg border border-[#efd8d0] bg-[#fff8f5] p-3"><p className="text-[11px] font-semibold text-[#805449]">Delete this agent?</p><p className="mt-1 text-[10px] leading-4 text-[#9a7164]">Its local draft and layout will be removed. This cannot be undone.</p><div className="mt-3 flex justify-end gap-2"><Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Keep agent</Button><Button type="button" size="sm" className="text-[#a05243] hover:bg-[#fff0eb]" onClick={() => { onDelete(); setConfirmDelete(false); onOpenChange(false) }}><Trash2 size={13} /> Delete agent</Button></div></div> : <Button type="button" size="sm" variant="ghost" className="text-[#a05243] hover:bg-[#fff0eb]" disabled={!canDelete} title={canDelete ? "Delete this agent" : "At least one agent must remain"} onClick={() => setConfirmDelete(true)}><Trash2 size={13} /> Delete agent</Button>}
            {!canDelete && <p className="mt-1 text-[10px] text-[#929d95]">At least one agent must remain.</p>}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" variant="primary" onClick={save}>Save settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
