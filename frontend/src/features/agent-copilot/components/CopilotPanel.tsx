import { ArrowUp, Bot, Lightbulb, Sparkles } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

const suggestions = [
  "Add a fallback when the caller is unsure",
  "Make the greeting feel warmer",
  "Review this flow for missing steps",
]

export function CopilotPanel() {
  const [prompt, setPrompt] = useState("")

  return (
    <section className="flex h-[280px] shrink-0 flex-col border-t border-[#e5e8e4] bg-white px-5 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e9f0ea] text-[#66846d]"><Sparkles size={14} /></div><div><p className="text-xs font-bold text-[#334039]">Agent Copilot</p><p className="text-[10px] text-[#9aa49d]">Shape the conversation with natural language</p></div></div>
        <span className="rounded-full bg-[#f0f3ef] px-2 py-1 text-[10px] font-semibold text-[#7d8b80]">Preview</span>
      </div>
      <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
        {suggestions.map((suggestion) => <button className="flex w-full items-center gap-2 rounded-lg border border-[#edf0ed] px-3 py-2 text-left text-[11px] text-[#68736c] hover:border-[#cbd8ce] hover:bg-[#f8faf8]" key={suggestion} type="button" onClick={() => setPrompt(suggestion)}><Lightbulb size={13} className="shrink-0 text-[#9eaf9f]" />{suggestion}</button>)}
      </div>
      <div className="relative mt-3"><Input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask Copilot to change the agent..." className="h-9 pr-9 text-xs" /><Button className="absolute right-1 top-1 h-7 w-7 p-0" size="sm" variant="primary" disabled={!prompt.trim()} title="Send request"><ArrowUp size={13} /></Button></div>
      <p className="mt-2 flex items-center gap-1 text-[10px] text-[#a0a9a2]"><Bot size={11} /> Suggestions are mocked in this scaffold.</p>
    </section>
  )
}
