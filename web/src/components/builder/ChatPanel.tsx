'use client'
import { useState, useRef, useEffect } from 'react'
import { useChatStore, type ChatMessage } from '@/store/chatStore'
import { useBuilderStore } from '@/store/builderStore'

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

// ── Build phase labels ────────────────────────────────────────────────────────
const PHASE_LABEL: Record<string, string> = {
  thinking: '🧠 Planning your website…',
  building: '⚙️ Building components…',
  done: '✓ Done',
}

// ── Single message bubble ─────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: ChatMessage }) {
  const [codeOpen, setCodeOpen] = useState(false)

  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-3 py-2 text-sm bg-primary text-primary-foreground">
          {msg.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] space-y-1">
        {msg.content && (
          <div className="rounded-2xl rounded-tl-sm px-3 py-2 text-sm bg-secondary text-foreground whitespace-pre-wrap">
            {msg.content}
          </div>
        )}
        {msg.generatedCode && (
          <div>
            <button
              onClick={() => setCodeOpen(o => !o)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
            >
              <span className="text-green-400">▣</span>
              <span>Code generated</span>
              <span className="ml-0.5">{codeOpen ? '▲' : '▼'}</span>
            </button>
            {codeOpen && (
              <pre className="mt-1 text-xs bg-zinc-900 text-zinc-300 rounded-lg px-3 py-2 overflow-x-auto max-h-48">
                <code>{msg.generatedCode}</code>
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Build phase indicator ─────────────────────────────────────────────────────
function BuildingIndicator({ phase }: { phase: string }) {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm px-3 py-2 bg-secondary/60 text-muted-foreground text-sm">
        <span className="flex gap-1">
          {[0, 150, 300].map(delay => (
            <span
              key={delay}
              className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
        <span>{PHASE_LABEL[phase] ?? 'Working…'}</span>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ChatPanel() {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  // Ref always points to the latest sendMessageText — prevents stale closure in event handlers
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
  const { project, setPreviewCode, credits, setCredits, activePage, updatePageContent, customInstructions, setActivePreviewTab } = useBuilderStore()

  function stopStream() {
    abortRef.current?.abort()
    abortRef.current = null
    finalizeStreamingMessage()
    setBuildPhase('idle')
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent, buildPhase])

  // Keep the ref in sync with the latest sendMessageText on every render
  useEffect(() => {
    sendMessageTextRef.current = sendMessageText
  })

  // Listen for quick-edit events — uses ref so it never captures a stale closure
  useEffect(() => {
    function handler(e: Event) {
      const { prompt } = (e as CustomEvent<{ prompt: string }>).detail
      if (!prompt) return
      // Read streaming from store directly to avoid stale closure
      const isStreaming = useChatStore.getState().streaming
      if (isStreaming) return
      addMessage({ role: 'user' as const, content: prompt, timestamp: Date.now() })
      sendMessageTextRef.current(prompt)
    }
    window.addEventListener('quick-edit', handler)
    return () => window.removeEventListener('quick-edit', handler)
  // Register once — the ref always has the latest function
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Core send function — accepts an explicit prompt or falls back to the textarea value */
  async function sendMessageText(overrideContent?: string) {
    const content = (overrideContent ?? input).trim()
    // Always read latest project/streaming from store so this never has a stale closure
    const { project: currentProject, customInstructions: currentInstructions, activePage: currentActivePage } = useBuilderStore.getState()
    const { streaming: currentStreaming } = useChatStore.getState()
    if (!content || currentStreaming || !currentProject) return

    if (!overrideContent) setInput('')
    const newUserMsg = { role: 'user' as const, content, timestamp: Date.now() }
    if (!overrideContent) addMessage(newUserMsg) // quick-edit already added the message
    setStreaming(true)
    setBuildPhase('thinking')

    const abort = new AbortController()
    abortRef.current = abort

    // Send the current live code from the store — always the right page,
    // always includes visual edits made outside the AI chat
    const currentCode = useBuilderStore.getState().previewCode || ''

    try {
      const res = await fetch('/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: currentProject.id,
          message: content,
          customInstructions: currentInstructions || undefined,
          currentCode: currentCode || undefined,
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
              // Switch to "building" once we see code starting to arrive
              if (buildPhase === 'thinking') setBuildPhase('building')
              appendStreamingContent(event.content)
            } else if (event.type === 'preview_update') {
              lastGeneratedCode = event.code
              setBuildPhase('building')
              setPreviewCode(event.code)
              setActivePreviewTab('preview') // auto-switch to preview tab
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
              // Save to version history
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
      // AbortError means the user clicked Stop — finalize silently without an error message
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

  // While streaming: show the non-code portion of accumulated text live
  const liveText = streamingContent
    ? streamingContent
        .replace(/```(?:jsx?|tsx?|javascript|typescript)[\s\S]*?```/g, '')
        .replace(/```(?:jsx?|tsx?|javascript|typescript)[^\n]*\n[\s\S]*/g, '') // partial open block
        .trim()
    : ''

  return (
    <aside className="w-80 flex flex-col border-r border-border bg-card shrink-0">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="text-primary">✦</span> AI Chat
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !streaming && (
          <div className="mt-8 space-y-3 text-center">
            <p className="text-muted-foreground text-sm">
              {activePage
                ? `Working on "${activePage.name}" — what would you like to add or change?`
                : 'Describe the website you want to build, and I\'ll plan it out and generate it for you.'}
            </p>
            <div className="flex flex-col gap-2">
              {getPageHints(activePage?.name ?? '').map(hint => (
                <button
                  key={hint}
                  onClick={() => setInput(hint)}
                  className="text-xs text-left px-3 py-2 rounded-lg border border-border hover:border-primary/50 hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}

        {/* Live non-code text while streaming */}
        {streaming && liveText && (
          <div className="flex justify-start">
            <div className="max-w-[90%] rounded-2xl rounded-tl-sm px-3 py-2 text-sm bg-secondary text-foreground whitespace-pre-wrap">
              {liveText}
              <span className="inline-block w-1 h-4 bg-primary ml-0.5 animate-pulse" />
            </div>
          </div>
        )}

        {/* Build phase indicator */}
        {streaming && buildPhase !== 'idle' && (
          <BuildingIndicator phase={buildPhase} />
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="Describe what to build…"
            rows={2}
            disabled={streaming}
            className="flex-1 px-3 py-2 bg-secondary border border-border rounded-md text-foreground placeholder-muted-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          />
          {streaming ? (
            <button
              onClick={stopStream}
              title="Stop generation"
              className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-md text-sm font-medium transition-colors self-end flex items-center gap-1"
            >
              <span className="w-2.5 h-2.5 bg-white rounded-sm inline-block" />
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity self-end"
            >
              ↑
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
