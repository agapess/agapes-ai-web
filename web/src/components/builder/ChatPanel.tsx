'use client'
import { useState, useRef, useEffect } from 'react'
import { useChatStore, type ChatMessage } from '@/store/chatStore'
import { useBuilderStore } from '@/store/builderStore'
import ProviderSelector from './ProviderSelector'

// ── Context-aware hints based on page type ────────────────────────────────────
function getPageHints(pageName: string): string[] {
  const n = pageName.toLowerCase()
  if (n.includes('contact')) return ['Add a map section', 'Simplify form to name + email only', 'Add office hours info', 'Add FAQ below the form']
  if (n.includes('about')) return ['Add a team member grid', 'Add a company timeline', 'Add client logos section', 'Make it more personal and story-driven']
  if (n.includes('pric')) return ['Add feature comparison table', 'Add testimonials below pricing', 'Add FAQ about billing', 'Add a money-back guarantee badge']
  if (n.includes('portfolio') || n.includes('gallery') || n.includes('work')) return ['Add filterable categories', 'Add a case study view', 'Add client testimonials', 'Make the grid masonry-style']
  if (n.includes('blog')) return ['Add a newsletter signup section', 'Add category filter tabs', 'Add a featured post at top', 'Add author bio cards']
  if (n.includes('service')) return ['Add a process / how-it-works section', 'Add client results / stats', 'Add before/after comparison', 'Add CTA with pricing link']
  if (n.includes('home') || n === '') return ['Add a testimonials section', 'Make the hero section more impactful', 'Add an animated features grid', 'Add a pricing preview section']
  return ['Add a new section', 'Improve the typography and spacing', 'Add hover animations and transitions', 'Make it fully responsive for mobile']
}

// ── Follow-up suggestions after AI response ──────────────────────────────────
function getFollowUpSuggestions(pageName: string): string[] {
  const n = pageName.toLowerCase()
  const base = ['Make it more visually striking', 'Improve mobile responsiveness', 'Add smooth animations']
  if (n.includes('home')) return ['Add a testimonials section', 'Improve the CTA buttons', 'Add a features grid']
  if (n.includes('contact')) return ['Add a map embed', 'Simplify the form', 'Add social links']
  if (n.includes('about')) return ['Add team photos', 'Add a timeline', 'Make it more personal']
  if (n.includes('pric')) return ['Add a toggle (monthly/annual)', 'Highlight the popular plan', 'Add FAQ section']
  return base
}

// ── Parse AI content into structured terminal lines ───────────────────────────
interface TerminalLine {
  type: 'plan' | 'step' | 'text' | 'success' | 'info'
  content: string
}

function parseContentToTerminal(content: string): TerminalLine[] {
  const lines: TerminalLine[] = []
  const rawLines = content.split('\n').filter(l => l.trim())

  for (const line of rawLines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Detect plan/heading lines
    if (trimmed.startsWith('**Plan') || trimmed.startsWith('Plan:') || trimmed.startsWith('**Design')) {
      lines.push({ type: 'plan', content: trimmed.replace(/\*\*/g, '') })
    }
    // Detect step/bullet lines
    else if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.match(/^\d+\./)) {
      lines.push({ type: 'step', content: trimmed.replace(/^[-•]\s*/, '').replace(/^\d+\.\s*/, '') })
    }
    // Detect success/completion lines
    else if (trimmed.startsWith('✓') || trimmed.startsWith('✅') || trimmed.toLowerCase().includes('done') || trimmed.toLowerCase().includes('complete')) {
      lines.push({ type: 'success', content: trimmed })
    }
    // Detect ideas/suggestions
    else if (trimmed.startsWith('**Ideas') || trimmed.startsWith('**Next') || trimmed.startsWith('Ideas')) {
      lines.push({ type: 'info', content: trimmed.replace(/\*\*/g, '') })
    }
    // Regular text
    else {
      lines.push({ type: 'text', content: trimmed.replace(/\*\*/g, '') })
    }
  }
  return lines
}

// ── Terminal-style message card ───────────────────────────────────────────────
function TerminalCard({ msg, isLast, onRegenerate }: {
  msg: ChatMessage
  isLast: boolean
  onRegenerate?: () => void
}) {
  const [codeOpen, setCodeOpen] = useState(false)
  const terminalLines = parseContentToTerminal(msg.content || '')

  return (
    <div className="space-y-2">
      {/* Terminal window */}
      <div className="rounded-xl border border-zinc-700/80 overflow-hidden shadow-lg bg-zinc-950">
        {/* Terminal title bar */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/80 border-b border-zinc-700/50">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
          </div>
          <span className="text-[10px] text-zinc-500 font-mono ml-1">ai-builder — output</span>
        </div>
        {/* Terminal body */}
        <div className="px-3 py-2.5 font-mono text-[11px] leading-[1.7] space-y-0.5 max-h-60 overflow-y-auto">
          {terminalLines.map((line, i) => (
            <div key={i} className="flex gap-2">
              {line.type === 'plan' && (
                <div className="text-cyan-400">
                  <span className="text-zinc-600 select-none">→ </span>
                  <span className="font-semibold">{line.content}</span>
                </div>
              )}
              {line.type === 'step' && (
                <div className="text-emerald-400">
                  <span className="text-zinc-600 select-none">  ✓ </span>
                  <span>{line.content}</span>
                </div>
              )}
              {line.type === 'success' && (
                <div className="text-green-300">
                  <span className="text-zinc-600 select-none">  ● </span>
                  <span className="font-medium">{line.content}</span>
                </div>
              )}
              {line.type === 'info' && (
                <div className="text-purple-400">
                  <span className="text-zinc-600 select-none">  ◆ </span>
                  <span>{line.content}</span>
                </div>
              )}
              {line.type === 'text' && (
                <div className="text-zinc-300">
                  <span className="text-zinc-600 select-none">  │ </span>
                  <span>{line.content}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Action row below terminal */}
      <div className="flex items-center gap-2 ml-1">
        {msg.generatedCode && (
          <button
            onClick={() => setCodeOpen(o => !o)}
            className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded-md bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span>{codeOpen ? 'Hide code' : 'View code'}</span>
          </button>
        )}
        {isLast && onRegenerate && (
          <button
            onClick={onRegenerate}
            className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded-md bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600"
          >
            <span>↺</span>
            <span>Retry</span>
          </button>
        )}
      </div>

      {codeOpen && msg.generatedCode && (
        <pre className="text-[10px] bg-zinc-950 text-zinc-400 rounded-lg px-3 py-2 overflow-x-auto max-h-40 border border-zinc-800 font-mono">
          <code>{msg.generatedCode}</code>
        </pre>
      )}
    </div>
  )
}

// ── User message bubble ──────────────────────────────────────────────────────
function UserBubble({ msg, isLastUser, onEditMessage }: {
  msg: ChatMessage
  isLastUser: boolean
  onEditMessage?: (content: string) => void
}) {
  return (
    <div className="flex justify-end group">
      <div className="relative max-w-[85%] rounded-2xl rounded-tr-md px-4 py-2.5 text-sm bg-primary text-primary-foreground shadow-sm">
        {msg.content}
        {isLastUser && onEditMessage && (
          <button
            onClick={() => onEditMessage(msg.content)}
            className="absolute -left-7 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
            title="Edit message"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

// ── Live streaming terminal ──────────────────────────────────────────────────
function StreamingTerminal({ content, phase }: { content: string; phase: string }) {
  const terminalLines = parseContentToTerminal(content)
  const phaseLabels: Record<string, string> = {
    thinking: 'analyzing request...',
    building: 'generating components...',
    done: 'complete',
  }

  return (
    <div className="rounded-xl border border-zinc-700/80 overflow-hidden shadow-lg bg-zinc-950">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/80 border-b border-zinc-700/50">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/80 animate-pulse" />
        </div>
        <span className="text-[10px] text-zinc-500 font-mono ml-1">ai-builder — {phaseLabels[phase] ?? 'working...'}</span>
        <span className="ml-auto flex gap-0.5">
          {[0, 150, 300].map(delay => (
            <span key={delay} className="w-1 h-1 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
          ))}
        </span>
      </div>
      {/* Body */}
      <div className="px-3 py-2.5 font-mono text-[11px] leading-[1.7] space-y-0.5 max-h-48 overflow-y-auto">
        {terminalLines.length > 0 ? terminalLines.map((line, i) => (
          <div key={i} className="flex gap-2">
            {line.type === 'plan' && (
              <div className="text-cyan-400">
                <span className="text-zinc-600 select-none">→ </span>
                <span className="font-semibold">{line.content}</span>
              </div>
            )}
            {line.type === 'step' && (
              <div className="text-emerald-400">
                <span className="text-zinc-600 select-none">  ✓ </span>
                <span>{line.content}</span>
              </div>
            )}
            {line.type === 'success' && (
              <div className="text-green-300">
                <span className="text-zinc-600 select-none">  ● </span>
                <span>{line.content}</span>
              </div>
            )}
            {line.type === 'info' && (
              <div className="text-purple-400">
                <span className="text-zinc-600 select-none">  ◆ </span>
                <span>{line.content}</span>
              </div>
            )}
            {line.type === 'text' && (
              <div className="text-zinc-300">
                <span className="text-zinc-600 select-none">  │ </span>
                <span>{line.content}</span>
              </div>
            )}
          </div>
        )) : (
          <div className="text-zinc-500">
            <span className="text-zinc-600 select-none">$ </span>
            <span>{phaseLabels[phase] ?? 'processing...'}</span>
            <span className="inline-block w-1.5 h-3 bg-cyan-400 ml-0.5 animate-pulse" />
          </div>
        )}
        {terminalLines.length > 0 && (
          <div className="text-zinc-500">
            <span className="inline-block w-1.5 h-3 bg-cyan-400 ml-4 animate-pulse" />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ChatPanel() {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const sendMessageTextRef = useRef<(override?: string) => Promise<void>>(async () => {})
  const {
    messages,
    streaming,
    streamingContent,
    buildPhase,
    addMessage,
    setStreaming,
    appendStreamingContent,
    finalizeStreamingMessage,
    setBuildPhase,
  } = useChatStore()
  const { project, setPreviewCode, credits, setCredits, activePage, updatePageContent, customInstructions, setActivePreviewTab, selectedProviderId, providers } = useBuilderStore()

  function stopStream() {
    abortRef.current?.abort()
    abortRef.current = null
    finalizeStreamingMessage()
    setBuildPhase('idle')
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent, buildPhase])

  useEffect(() => {
    sendMessageTextRef.current = sendMessageText
  })

  // Listen for quick-edit events
  useEffect(() => {
    function handler(e: Event) {
      const { prompt } = (e as CustomEvent<{ prompt: string }>).detail
      if (!prompt) return
      const isStreaming = useChatStore.getState().streaming
      if (isStreaming) return
      addMessage({ role: 'user' as const, content: prompt, timestamp: Date.now() })
      sendMessageTextRef.current(prompt)
    }
    window.addEventListener('quick-edit', handler)
    return () => window.removeEventListener('quick-edit', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Core send function */
  async function sendMessageText(overrideContent?: string) {
    const content = (overrideContent ?? input).trim()
    const { project: currentProject, customInstructions: currentInstructions, activePage: currentActivePage, selectedProviderId: currentProviderId, providers: currentProviders } = useBuilderStore.getState()
    const { streaming: currentStreaming } = useChatStore.getState()
    if (!content || currentStreaming || !currentProject) return

    if (!overrideContent) setInput('')
    const newUserMsg = { role: 'user' as const, content, timestamp: Date.now() }
    if (!overrideContent) addMessage(newUserMsg)
    setStreaming(true)
    setBuildPhase('thinking')

    const abort = new AbortController()
    abortRef.current = abort

    const currentCode = useBuilderStore.getState().previewCode || ''
    const selectedProvider = currentProviders.find(p => p.id === currentProviderId)

    try {
      const res = await fetch('/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: currentProject.id,
          message: content,
          customInstructions: currentInstructions || undefined,
          currentCode: currentCode || undefined,
          provider: selectedProvider?.provider || undefined,
        }),
        signal: abort.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Stream failed' }))
        addMessage({ role: 'assistant', content: `⚠️ ${err.error}`, timestamp: Date.now() })
        setStreaming(false)
        setBuildPhase('idle')
        return
      }

      const creditCost = parseInt(res.headers.get('X-Credit-Cost') ?? '0', 10)
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let success = false
      let lastGeneratedCode: string | undefined

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const lines = decoder.decode(value, { stream: true })
          .split('\n')
          .filter(l => l.startsWith('data: '))

        for (const line of lines) {
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'text_delta') {
              if (buildPhase === 'thinking') setBuildPhase('building')
              appendStreamingContent(event.content)
            } else if (event.type === 'preview_update') {
              lastGeneratedCode = event.code
              setBuildPhase('building')
              setPreviewCode(event.code)
              setActivePreviewTab('preview')
              if (currentActivePage && currentProject) {
                updatePageContent(currentActivePage.id, event.code)
                fetch(`/api/pages/${currentProject.id}/${currentActivePage.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ content: event.code }),
                }).catch(() => {})
              }
            } else if (event.type === 'done') {
              success = true
              finalizeStreamingMessage(lastGeneratedCode)
              if (lastGeneratedCode && currentProject && currentActivePage) {
                fetch(`/api/history/${currentProject.id}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    pageId: currentActivePage.id,
                    content: lastGeneratedCode,
                    description: `AI: ${content.slice(0, 60)}${content.length > 60 ? '…' : ''}`,
                  }),
                }).catch(() => {})
              }
            } else if (event.type === 'error') {
              addMessage({ role: 'assistant', content: `⚠️ ${event.message}`, timestamp: Date.now() })
              finalizeStreamingMessage()
            }
          } catch { /* skip malformed */ }
        }
      }

      if (success && creditCost > 0) {
        fetch('/api/ai/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ creditCost, description: `AI generation for project ${currentProject.id}` }),
        }).catch(() => {})
        setCredits(Math.max(0, credits - creditCost))
      }

      const updatedMessages = [...messages, newUserMsg]
      fetch(`/api/chat-sessions/${currentProject.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      }).catch(() => {})

    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        finalizeStreamingMessage()
      } else {
        finalizeStreamingMessage()
      }
    } finally {
      abortRef.current = null
    }
  }

  function sendMessage() {
    sendMessageText()
  }

  // Live non-code text while streaming
  const liveText = streamingContent
    ? streamingContent
        .replace(/```(?:jsx?|tsx?|javascript|typescript)[\s\S]*?```/g, '')
        .replace(/```(?:jsx?|tsx?|javascript|typescript)[^\n]*\n[\s\S]*/g, '')
        .trim()
    : ''

  // Find last user/assistant message indexes
  const lastUserIdx = messages.reduce((acc, m, i) => m.role === 'user' ? i : acc, -1)
  const lastAssistantIdx = messages.reduce((acc, m, i) => m.role === 'assistant' ? i : acc, -1)

  function handleRegenerate() {
    if (streaming) return
    const lastUser = messages.filter(m => m.role === 'user').pop()
    if (lastUser) sendMessageText(lastUser.content)
  }

  function handleEditMessage(content: string) {
    setInput(content)
  }

  return (
    <aside className="w-80 flex flex-col border-r border-border bg-card shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="w-5 h-5 rounded-md bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <span className="text-white text-[10px]">✦</span>
          </span>
          AI Assistant
        </h2>
        {activePage && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border font-mono">
            {activePage.name}
          </span>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {messages.length === 0 && !streaming && (
          <div className="mt-4 space-y-4">
            <div className="text-center space-y-2">
              <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
                <span className="text-primary text-lg">✦</span>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {activePage
                  ? `Working on "${activePage.name}" — describe what to change or add.`
                  : 'Describe the website you want to build.'}
              </p>
            </div>
            <div className="flex flex-col gap-1.5 pt-2">
              {getPageHints(activePage?.name ?? '').map(hint => (
                <button
                  key={hint}
                  onClick={() => setInput(hint)}
                  className="text-[11px] text-left px-3 py-2 rounded-lg border border-border/80 hover:border-primary/40 hover:bg-primary/5 transition-all text-muted-foreground hover:text-foreground group font-mono"
                >
                  <span className="opacity-50 group-hover:opacity-100 transition-opacity mr-1.5 text-cyan-500">$</span>
                  {hint}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.role === 'user') {
            return (
              <UserBubble
                key={i}
                msg={msg}
                isLastUser={i === lastUserIdx}
                onEditMessage={i === lastUserIdx && !streaming ? handleEditMessage : undefined}
              />
            )
          }
          return (
            <TerminalCard
              key={i}
              msg={msg}
              isLast={i === lastAssistantIdx}
              onRegenerate={i === lastAssistantIdx && !streaming ? handleRegenerate : undefined}
            />
          )
        })}

        {/* Follow-up suggestion chips after last AI response */}
        {!streaming && messages.length > 0 && lastAssistantIdx === messages.length - 1 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {getFollowUpSuggestions(activePage?.name ?? '').map(suggestion => (
              <button
                key={suggestion}
                onClick={() => { addMessage({ role: 'user', content: suggestion, timestamp: Date.now() }); sendMessageText(suggestion) }}
                className="text-[10px] px-2.5 py-1.5 rounded-md border border-zinc-700/60 hover:border-cyan-500/40 hover:bg-cyan-500/5 text-zinc-400 hover:text-zinc-200 transition-all font-mono"
              >
                <span className="text-cyan-500 mr-1">$</span>{suggestion}
              </button>
            ))}
          </div>
        )}

        {/* Live streaming terminal */}
        {streaming && (
          <StreamingTerminal content={liveText} phase={buildPhase} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area — card style */}
      <div className="p-3 border-t border-border">
        <div className="bg-zinc-900/80 border border-zinc-700/60 rounded-xl p-2.5 focus-within:border-cyan-500/50 transition-all">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder={activePage ? `$ describe changes to ${activePage.name}…` : '$ describe what to build…'}
            rows={3}
            disabled={streaming}
            className="w-full bg-transparent text-zinc-200 placeholder-zinc-600 text-sm resize-none focus:outline-none disabled:opacity-50 leading-relaxed font-mono"
          />
          {/* Footer: provider selector + send button */}
          <div className="flex items-center justify-between pt-1.5 border-t border-zinc-700/40 mt-1">
            <ProviderSelector />
            <div className="flex items-center gap-1.5">
              {streaming ? (
                <button
                  onClick={stopStream}
                  title="Stop generation"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-600/90 hover:bg-red-500 text-white rounded-lg text-[11px] font-medium transition-colors"
                >
                  <span className="w-2 h-2 bg-white rounded-sm" />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  title="Send (Enter)"
                  className="flex items-center justify-center w-7 h-7 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 disabled:opacity-30 transition-all disabled:cursor-not-allowed"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
