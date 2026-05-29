'use client'
import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview,
  SandpackCodeEditor,
} from '@codesandbox/sandpack-react'
import { useBuilderStore } from '@/store/builderStore'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

const DEFAULT_CODE = `export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-purple-900 flex items-center justify-center">
      <div className="text-center text-white px-6">
        <h1 className="text-5xl font-bold mb-4">Your website starts here</h1>
        <p className="text-purple-200 text-lg">Chat with AI to build your website. Your live preview will appear here.</p>
      </div>
    </div>
  )
}`

const PREVIEW_WIDTHS = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
}

const QUICK_EDITS = [
  { label: 'Darker background', prompt: 'Make the background darker and more dramatic' },
  { label: 'Lighter background', prompt: 'Make the background lighter and cleaner' },
  { label: 'Add animations', prompt: 'Add smooth fade-in and hover animations to elements' },
  { label: 'More rounded', prompt: 'Make all cards and buttons more rounded' },
  { label: 'Add shadows', prompt: 'Add subtle drop shadows to cards and sections' },
  { label: 'Bigger headings', prompt: 'Increase heading font sizes and improve typography hierarchy' },
  { label: 'More spacing', prompt: 'Add more padding and spacing between sections' },
  { label: 'Add gradient text', prompt: 'Add beautiful gradient effects to headings and key text' },
]

// ── Extract human-readable text strings from JSX code ────────────────────────
function extractJsxTexts(code: string): string[] {
  const seen = new Set<string>()
  const results: string[] = []
  // Match text between JSX opening tag close > and closing tag </
  // Skips expressions {}, class names, pure-whitespace, very short strings
  const re = />([^<{}\n\r]{2,200}?)</g
  let m: RegExpExecArray | null
  while ((m = re.exec(code)) !== null) {
    const t = m[1].trim()
    if (
      t.length >= 2 &&
      !t.startsWith('//') &&
      !t.startsWith('*') &&
      !/^\s*$/.test(t) &&
      // Skip things that look like code/class names
      !/^[a-z]+\(/.test(t) &&
      !seen.has(t)
    ) {
      seen.add(t)
      results.push(t)
    }
  }
  return results
}

// ── Single editable text row ──────────────────────────────────────────────────
function TextRow({
  text,
  onApply,
}: {
  text: string
  onApply: (oldText: string, newText: string) => void
}) {
  const [value, setValue] = useState(text)
  const savedRef = useRef(text)

  // Sync when parent re-derives texts (e.g., after AI update)
  useEffect(() => {
    setValue(text)
    savedRef.current = text
  }, [text])

  function commit() {
    const trimmed = value.trim()
    if (trimmed && trimmed !== savedRef.current) {
      onApply(savedRef.current, trimmed)
      savedRef.current = trimmed
    }
  }

  return (
    <input
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); e.currentTarget.blur() }
        if (e.key === 'Escape') { setValue(savedRef.current); e.currentTarget.blur() }
      }}
      className="w-full px-2 py-1.5 text-xs bg-secondary border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
    />
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PreviewPanel() {
  const {
    previewCode,
    previewSize,
    previewTheme,
    setPreviewTheme,
    activePreviewTab,
    setActivePreviewTab,
    setPreviewSize,
    setPreviewCode,
    activePage,
    project,
    updatePageContent,
  } = useBuilderStore()

  const [fullscreen, setFullscreen] = useState(false)
  const [containerHeight, setContainerHeight] = useState(0)
  const [showEditPanel, setShowEditPanel] = useState(false)
  const [editTab, setEditTab] = useState<'text' | 'styles'>('text')
  const containerRef = useRef<HTMLDivElement>(null)
  const editPanelRef = useRef<HTMLDivElement>(null)

  // Guard: page.content defaults to [] (JSON array) on new pages — always use a string
  const code = typeof previewCode === 'string' && previewCode.trim() ? previewCode : DEFAULT_CODE

  // Extract text strings from current JSX code
  const extractedTexts = useMemo(() => extractJsxTexts(code), [code])

  // ── Close panel on outside click ──────────────────────────────────────────
  useEffect(() => {
    if (!showEditPanel) return
    function handler(e: MouseEvent) {
      if (editPanelRef.current && !editPanelRef.current.contains(e.target as Node)) {
        setShowEditPanel(false)
      }
    }
    // Use mousedown so it fires before focus events on inputs
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showEditPanel])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showEditPanel) { setShowEditPanel(false); return }
        if (fullscreen) setFullscreen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [fullscreen, showEditPanel])

  // ── Measure container height for Sandpack ────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setContainerHeight(entry.contentRect.height)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const sandpackHeight = containerHeight > 0 ? `${containerHeight}px` : '100%'

  // ── Apply a text replacement to the code ─────────────────────────────────
  const applyTextEdit = useCallback((oldText: string, newText: string) => {
    const escaped = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const updated = code.replace(new RegExp(escaped, 'g'), newText)
    setPreviewCode(updated)
    if (activePage && project) {
      updatePageContent(activePage.id, updated)
      fetch(`/api/pages/${project.id}/${activePage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: updated }),
      }).catch(() => {})
    }
  }, [code, setPreviewCode, activePage, project, updatePageContent])

  // ── Send a quick-style prompt to the AI ──────────────────────────────────
  const applyQuickStyle = useCallback((prompt: string) => {
    setShowEditPanel(false)
    window.dispatchEvent(new CustomEvent('quick-edit', { detail: { prompt } }))
  }, [])

  return (
    <div className={`flex flex-col bg-zinc-950 overflow-hidden ${fullscreen ? 'fixed inset-0 z-50' : 'flex-1'}`}>
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-card shrink-0">
        {/* Preview / Code tabs */}
        {(['preview', 'code'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActivePreviewTab(tab)}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
              activePreviewTab === tab
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'preview' ? 'Preview' : 'Code'}
          </button>
        ))}

        {/* Device size toggles */}
        {activePreviewTab === 'preview' && (
          <div className="flex items-center gap-0.5 ml-2 border-l border-border pl-2">
            {([
              { key: 'desktop', icon: '🖥', label: 'Desktop' },
              { key: 'tablet', icon: '📱', label: 'Tablet' },
              { key: 'mobile', icon: '📲', label: 'Mobile' },
            ] as const).map(({ key, icon, label }) => (
              <button
                key={key}
                onClick={() => setPreviewSize(key)}
                title={label}
                className={`px-1.5 py-0.5 text-xs rounded transition-colors ${
                  previewSize === key ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        )}

        {/* Right-side controls */}
        <div className="ml-auto flex items-center gap-1">
          {/* Edit panel toggle — only in preview mode */}
          {activePreviewTab === 'preview' && (
            <div ref={editPanelRef} className="relative">
              <button
                onMouseDown={e => e.stopPropagation()} // prevent doc mousedown from closing before toggle
                onClick={() => setShowEditPanel(o => !o)}
                title="Edit content & styles"
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                  showEditPanel
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                <span>✏️</span>
                <span>Edit</span>
              </button>

              {showEditPanel && (
                <div className="absolute right-0 top-full mt-1.5 w-80 bg-card border border-border rounded-xl shadow-2xl z-30 overflow-hidden flex flex-col">
                  {/* Edit panel tabs */}
                  <div className="flex border-b border-border">
                    {(['text', 'styles'] as const).map(t => (
                      <button
                        key={t}
                        onMouseDown={e => e.stopPropagation()}
                        onClick={() => setEditTab(t)}
                        className={`flex-1 py-2 text-xs font-medium transition-colors ${
                          editTab === t
                            ? 'text-foreground border-b-2 border-primary'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {t === 'text' ? '✏️ Edit Text' : '🎨 Quick Styles'}
                      </button>
                    ))}
                  </div>

                  {/* Text editing tab */}
                  {editTab === 'text' && (
                    <div className="flex flex-col max-h-80 overflow-y-auto">
                      {extractedTexts.length === 0 ? (
                        <p className="px-4 py-6 text-xs text-muted-foreground text-center">
                          No editable text found.<br />Ask AI to build something first.
                        </p>
                      ) : (
                        <div className="p-3 space-y-2">
                          <p className="text-xs text-muted-foreground mb-3">
                            Click any field to edit. Press Enter or click away to apply.
                          </p>
                          {extractedTexts.map((text, i) => (
                            <div key={`${text}-${i}`}>
                              <TextRow text={text} onApply={applyTextEdit} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quick styles tab */}
                  {editTab === 'styles' && (
                    <div className="flex flex-col max-h-80 overflow-y-auto">
                      <p className="px-3 pt-3 pb-1 text-xs text-muted-foreground">
                        Ask AI to apply a style change instantly.
                      </p>
                      {QUICK_EDITS.map(qe => (
                        <button
                          key={qe.label}
                          onMouseDown={e => e.stopPropagation()}
                          onClick={() => applyQuickStyle(qe.prompt)}
                          className="w-full text-left px-3 py-2.5 text-xs hover:bg-secondary transition-colors text-foreground flex items-center gap-2 group"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                          {qe.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setPreviewTheme(previewTheme === 'dark' ? 'light' : 'dark')}
            title={`Switch to ${previewTheme === 'dark' ? 'light' : 'dark'} mode`}
            className="px-2 py-1 text-xs rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            {previewTheme === 'dark' ? '☀️' : '🌙'}
          </button>

          <button
            onClick={() => setFullscreen(!fullscreen)}
            title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
            className="px-2 py-1 text-xs rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            {fullscreen ? '⊠' : '⊞'}
          </button>
        </div>
      </div>

      {/* ── Preview / Code area ───────────────────────────────────────────── */}
      <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden flex justify-center">
        <div
          className="transition-all duration-300"
          style={{
            width: fullscreen ? '100%' : PREVIEW_WIDTHS[previewSize],
            maxWidth: '100%',
            height: sandpackHeight,
          }}
        >
          <SandpackProvider
            template="react"
            theme={previewTheme === 'light' ? 'light' : 'dark'}
            files={{ '/App.js': code }}
            options={{ externalResources: ['https://cdn.tailwindcss.com'] }}
          >
            <SandpackLayout style={{ height: sandpackHeight, borderRadius: 0 }}>
              {activePreviewTab === 'preview' ? (
                <SandpackPreview
                  style={{ height: sandpackHeight }}
                  showOpenInCodeSandbox={false}
                  showNavigator={false}
                />
              ) : (
                <SandpackCodeEditor style={{ height: sandpackHeight }} showLineNumbers />
              )}
            </SandpackLayout>
          </SandpackProvider>
        </div>
      </div>

      {fullscreen && (
        <div className="absolute top-14 right-4 text-xs text-muted-foreground pointer-events-none">
          Press <kbd className="px-1 py-0.5 bg-secondary rounded text-foreground">Esc</kbd> to exit
        </div>
      )}
    </div>
  )
}
