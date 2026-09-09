import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog"
import { Button } from "@/components/ui/Button"
import { FormField } from "@/components/ui/FormField"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { getNextNodeName } from "../lib/agentOperations"
import { humanizeIdentifier, toIdentifier } from "../lib/identifier"
import type { AgentNode, NodeCreationInput, NodeCreationKind } from "../model/type"

interface NodeCreationDialogProps {
  kind: NodeCreationKind | null
  nodes: AgentNode[]
  onCancel: () => void
  onSubmit: (input: NodeCreationInput) => void
}

export function NodeCreationDialog({ kind, nodes, onCancel, onSubmit }: NodeCreationDialogProps) {
  const [name, setName] = useState("")
  const [instruction, setInstruction] = useState("")
  const [roleMessage, setRoleMessage] = useState("")
  const [toolName, setToolName] = useState("")
  const [toolDescription, setToolDescription] = useState("")
  const [confirmationRequired, setConfirmationRequired] = useState(false)
  const [branchExpression, setBranchExpression] = useState("")
  const [transferReason, setTransferReason] = useState("")
  const [transferContext, setTransferContext] = useState("")
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!kind) return
    setName(humanizeIdentifier(getNextNodeName(nodes, kind)))
    setInstruction("")
    setRoleMessage("")
    setToolName("")
    setToolDescription("")
    setConfirmationRequired(false)
    setBranchExpression("")
    setTransferReason("")
    setTransferContext("")
    setSubmitted(false)
  }, [kind, nodes])

  const trimmedName = name.trim()
  const normalizedName = toIdentifier(trimmedName)
  const nameError = !normalizedName ? "Node name is required." : nodes.some((node) => node.name === normalizedName) ? "Node names must be unique." : undefined
  const instructionError = !instruction.trim() ? "Task instruction is required." : undefined
  const toolNameError = kind === "tool" && !toolName.trim() ? "Tool name is required." : undefined
  const toolDescriptionError = kind === "tool" && !toolDescription.trim() ? "Tool description is required." : undefined
  const branchError = kind === "branch" && !branchExpression.trim() ? "Branch expression is required." : undefined
  const transferError = kind === "transfer" && !transferReason.trim() ? "Handoff reason is required." : undefined
  const canSubmit = !nameError && !instructionError && !toolNameError && !toolDescriptionError && !branchError && !transferError
  const typeLabel = kind === "end" ? "End" : kind ? kind.charAt(0).toUpperCase() + kind.slice(1) : "Node"
  const typeDescription = kind === "conversation" ? "A focused spoken interaction where the agent asks questions, explains something, or gathers context." : kind === "tool" ? "A mock action such as searching availability or confirming a booking. Configure its name and expected result for this demo." : kind === "branch" ? "A routing decision that sends the conversation down a condition or fallback path." : kind === "transfer" ? "A controlled handoff to a human team with a reason and optional context." : kind === "end" ? "An explicit completion or failure point that ends the conversation." : "Set up the required details before adding this node to the graph."

  const submit = () => {
    setSubmitted(true)
    if (!canSubmit) return
    onSubmit({
      name: normalizedName,
      title: trimmedName,
      instruction: instruction.trim(),
      roleMessage,
      type: kind ?? "conversation",
      ...(kind === "tool" ? { tool: { name: toIdentifier(toolName), description: toolDescription.trim(), confirmationRequired } } : {}),
      ...(kind === "branch" ? { branch: { expression: branchExpression.trim() } } : {}),
      ...(kind === "transfer" ? { transfer: { reason: transferReason.trim(), context: transferContext.trim() } } : {}),
    })
  }

  return <Dialog open={kind !== null} onOpenChange={(open) => !open && onCancel()}>
    <DialogContent aria-describedby="node-creation-description">
      <DialogHeader>
      <DialogTitle className="text-lg font-semibold text-[#27312c]">Add {typeLabel} Node</DialogTitle>
      <DialogDescription id="node-creation-description" className="text-xs leading-5 text-[#8c968f]">{typeDescription}</DialogDescription>
      </DialogHeader>
      <div className="mt-5 space-y-4">
        <FormField label="Node title" info="The readable title shown on the graph. The editor creates a stable technical ID separately." error={submitted ? nameError : undefined}><Input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={kind === "end" ? "e.g. Goodbye" : "e.g. Collect details"} /></FormField>
        <FormField label="Task instruction" info="What the voice agent should do while this node is active." error={submitted ? instructionError : undefined}><Textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Describe what the agent should say, ask, or accomplish..." className="min-h-24" /></FormField>
        <FormField label="Node-specific guidance" info="Optional guidance that replaces the global persona while this node is active."><Textarea value={roleMessage} onChange={(event) => setRoleMessage(event.target.value)} placeholder="Optional node-specific guidance..." className="min-h-16" /></FormField>
        {kind === "tool" && <div className="space-y-3 rounded-xl border border-[#e3e9e3] bg-white p-3"><p className="text-xs font-semibold text-[#455249]">Mock tool setup</p><FormField label="Tool name" info="The action name represented by this demo node." error={submitted ? toolNameError : undefined}><Input value={toolName} onChange={(event) => setToolName(event.target.value)} placeholder="e.g. Search availability" /></FormField><FormField label="What it does" info="Describe the operation and the result it returns." error={submitted ? toolDescriptionError : undefined}><Textarea value={toolDescription} onChange={(event) => setToolDescription(event.target.value)} placeholder="e.g. Finds open appointment slots." className="min-h-16" /></FormField><label className="flex items-center gap-2 text-[11px] text-[#68736c]"><input type="checkbox" checked={confirmationRequired} onChange={(event) => setConfirmationRequired(event.target.checked)} /> Require confirmation before this action</label></div>}
        {kind === "branch" && <FormField label="Routing rule" info="The simple condition used to decide which branch the caller follows." error={submitted ? branchError : undefined}><Input value={branchExpression} onChange={(event) => setBranchExpression(event.target.value)} placeholder="e.g. intent is book" /></FormField>}
        {kind === "transfer" && <div className="space-y-3 rounded-xl border border-[#e3e9e3] bg-white p-3"><FormField label="Handoff reason" info="Why the agent should transfer this conversation to a person." error={submitted ? transferError : undefined}><Input value={transferReason} onChange={(event) => setTransferReason(event.target.value)} placeholder="e.g. Caller requests a human" /></FormField><FormField label="Handoff context" info="Optional context to pass to the receiving team."><Textarea value={transferContext} onChange={(event) => setTransferContext(event.target.value)} placeholder="Optional context for the receiving team..." className="min-h-16" /></FormField></div>}
      </div>
      <DialogFooter><Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button><Button type="button" variant="primary" onClick={submit}>Add {typeLabel} Node</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
