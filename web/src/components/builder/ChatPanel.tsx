'use client'
import { useState, useRef, useEffect } from 'react'
import { useChatStore } from '@/store/chatStore'
import { useBuilderStore } from '@/store/builderStore'

export default function ChatPanel() {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const {
    messages,
    streaming,
    streamingContent,
    addMessage,
    setStreaming,
    appendStreamingContent,
    finalizeStreamingMessage,
  } = useChatStore()
  const { project, setPreviewCode, credits, setCredits, activePage, updatePageContent } = useBuilderStore()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  async function sendMessage() {
    const content = input.trim()
    if (!content || streaming || !project) return

    const newUserMsg = { role: 'user' as const, content, timestamp: Date.now() }
    setInput('')
    addMessage(newUserMsg)
    setStreaming(true)

    try {
      const res = await fetch('/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, message: content }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Stream failed' }))
        addMessage({ role: 'assistant', content: `Error: ${err.error}`, timestamp: Date.now() })
        setStreaming(false)
        return
      }

      const creditCost = parseInt(res.headers.get('X-Credit-Cost') ?? '0', 10)
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let success = false

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
              appendStreamingContent(event.content)
            } else if (event.type === 'preview_update') {
              setPreviewCode(event.code)
              if (activePage && project) {
                updatePageContent(activePage.id, event.code)
                fetch(`/api/pages/${project.id}/${activePage.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ content: event.code }),
                }).catch(() => {})
              }
            } else if (event.type === 'done') {
              success = true
              finalizeStreamingMessage()
            } else if (event.type === 'error') {
              finalizeStreamingMessage()
            }
          } catch { /* skip malformed */ }
        }
      }

      // Deduct credits after successful stream (fire and forget)
      if (success && creditCost > 0) {
        fetch('/api/ai/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ creditCost, description: `AI generation for project ${project.id}` }),
        }).catch(() => {})
        setCredits(Math.max(0, credits - creditCost))
      }

      // Save chat session (fire and forget)
      const updatedMessages = [...messages, newUserMsg]
      fetch(`/api/chat-sessions/${project.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      }).catch(() => {})

    } catch {
      finalizeStreamingMessage()
    }
  }

  return (
    <aside className="w-80 flex flex-col border-r border-border bg-card shrink-0">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="text-primary">✦</span> AI Chat
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !streaming && (
          <p className="text-muted-foreground text-sm text-center mt-8">
            Describe the website you want to build…
          </p>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-foreground'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {streaming && streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-secondary text-foreground">
              {streamingContent}
              <span className="inline-block w-1 h-4 bg-primary ml-0.5 animate-pulse" />
            </div>
          </div>
        )}

        {streaming && !streamingContent && (
          <div className="flex justify-start">
            <div className="px-3 py-2 bg-secondary rounded-lg">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
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
          <button
            onClick={sendMessage}
            disabled={streaming || !input.trim()}
            className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity self-end"
          >
            ↑
          </button>
        </div>
      </div>
    </aside>
  )
}
