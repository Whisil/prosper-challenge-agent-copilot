import { useEffect, useState } from "react"
import { Button } from "@/components/ui/Button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog"
import { FormField } from "@/components/ui/FormField"
import { Textarea } from "@/components/ui/Textarea"

interface AgentSettingsDialogProps {
  open: boolean
  persona: string
  onOpenChange: (open: boolean) => void
  onSave: (persona: string) => void
}

export function AgentSettingsDialog({ open, persona, onOpenChange, onSave }: AgentSettingsDialogProps) {
  const [personaDraft, setPersonaDraft] = useState(persona)

  useEffect(() => {
    if (open) setPersonaDraft(persona)
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
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" variant="primary" onClick={save}>Save settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
