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
  { label: 'More rounded corners', prompt: 'Make all cards and buttons more rounded' },
  { label: 'Add drop shadows', prompt: 'Add subtle drop shadows to cards and sections' },
  { label: 'Bigger headings', prompt: 'Increase heading font sizes and improve typography hierarchy' },
  { label: 'More padding/spacing', prompt: 'Add more padding and spacing between sections' },
  { label: 'Gradient text effects', prompt: 'Add beautiful gradient effects to headings and key text' },
  { label: 'Glass morphism', prompt: 'Apply glass morphism effect with backdrop blur to cards' },
  { label: 'Minimal & clean', prompt: 'Simplify the design to be more minimal, clean, and modern' },
]

// ── Tag-aware text extraction ─────────────────────────────────────────────────
interface TextEntry {
  tag: string      // 'h1', 'h2', 'p', 'button', etc.
  label: string    // human-readable label for the UI
  text: string     // current text value
}

const TAG_LABELS: Record<string, string> = {
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  h4: 'Heading 4',
  h5: 'Heading 5',
  h6: 'Heading 6',
  p: 'Paragraph',
  button: 'Button',
  a: 'Link',
  span: 'Text',
  li: 'List item',
  label: 'Label',
  th: 'Table header',
  td: 'Table cell',
  dt: 'Term',
  dd: 'Description',
  blockquote: 'Quote',
  figcaption: 'Caption',
}

function extractTaggedTexts(code: string): TextEntry[] {
  const results: TextEntry[] = []
  const seen = new Set<string>()
  const tagPattern = Object.keys(TAG_LABELS).join('|')

  // Match <tag ...>text content</tag> where text has no nested JSX tags
  // Handles multi-class JSX like <h1 className="...">Title</h1>
  const re = new RegExp(
    `<(${tagPattern})[^>]*>([^<{}\n\r]{1,300}?)<\\/(?:${tagPattern})>`,
    'g',
  )

  // Also match tags where content is text + simple closing tag e.g.:
  //   <button className="...">Get Started</button>
  const re2 = new RegExp(
    `<(${tagPattern})[^>]*>\\s*([^<{}\n\r]{1,300}?)\\s*<\\/(?:${tagPattern})>`,
    'g',
  )

  for (const regex of [re, re2]) {
    regex.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = regex.exec(code)) !== null) {
      const tag = m[1]
      const raw = m[2].trim()
      // Skip empty, pure-whitespace, JSX expressions, or things that look like code
      if (
        !raw ||
        raw.length < 1 ||
        /^\{/.test(raw) ||
        /^\d+$/.test(raw) ||
        /^[A-Z_]+$/.test(raw) ||   // constants
        seen.has(raw)
      ) continue
      seen.add(raw)
      results.push({
        tag,
        label: TAG_LABELS[tag] ?? tag,
        text: raw,
      })
    }
  }

  return results
}

// ── Single editable row ───────────────────────────────────────────────────────
function TextRow({
  entry,
  onApply,
}: {
  entry: TextEntry
  onApply: (oldText: string, newText: string) => void
}) {
  const [value, setValue] = useState(entry.text)
  const savedRef = useRef(entry.text)

  useEffect(() => {
    setValue(entry.text)
    savedRef.current = entry.text
  }, [entry.text])

  function commit() {
    const trimmed = value.trim()
    if (trimmed && trimmed !== savedRef.current) {
      onApply(savedRef.current, trimmed)
      savedRef.current = trimmed
    }
  }

  const tagColor: Record<string, string> = {
    h1: 'text-yellow-400',
    h2: 'text-amber-400',
    h3: 'text-orange-400',
    h4: 'text-orange-300',
    h5: 'text-orange-200',
    h6: 'text-orange-100',
    p: 'text-blue-400',
    button: 'text-green-400',
    a: 'text-purple-400',
    span: 'text-zinc-400',
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <span className={`text-[10px] font-mono font-bold ${tagColor[entry.tag] ?? 'text-muted-foreground'}`}>
          {`<${entry.tag}>`}
        </span>
        <span className="text-[10px] text-muted-foreground">{entry.label}</span>
      </div>
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); e.currentTarget.blur() }
          if (e.key === 'Escape') { setValue(savedRef.current); e.currentTarget.blur() }
        }}
        className="w-full px-2 py-1.5 text-xs bg-secondary border border-border rounded-md text-foreground focus:outline-none focus:border-primary transition-colors"
      />
    </div>
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

  // Guard: page.content defaults to [] (JSON array) on new pages
  const code = typeof previewCode === 'string' && previewCode.trim() ? previewCode : DEFAULT_CODE

  // Derive text entries from current code
  const textEntries = useMemo(() => extractTaggedTexts(code), [code])

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

  // ── Text edit handler ─────────────────────────────────────────────────────
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

  // ── Quick AI style prompt ─────────────────────────────────────────────────
  const applyQuickStyle = useCallback((prompt: string) => {
    setShowEditPanel(false)
    window.dispatchEvent(new CustomEvent('quick-edit', { detail: { prompt } }))
  }, [])

  return (
    <div className={`flex flex-col bg-zinc-950 overflow-hidden ${fullscreen ? 'fixed inset-0 z-50' : 'flex-1'}`}>
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-card shrink-0">
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

        <div className="ml-auto flex items-center gap-1">
          {activePreviewTab === 'preview' && (
            <button
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
      <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden flex justify-center relative">
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

        {/* ── Edit panel — rendered inside the preview area so it floats above it
             A full-size transparent backdrop closes the panel on any outside click,
             including clicks that land on the Sandpack iframe which blocks
             document-level mousedown events. ───────────────────────────────── */}
        {showEditPanel && (
          <>
            {/* Backdrop: covers everything behind the panel, including the iframe */}
            <div
              className="absolute inset-0 z-10"
              onClick={() => setShowEditPanel(false)}
            />

            {/* Panel: positioned top-right, above the backdrop */}
            <div
              className="absolute top-2 right-2 z-20 w-80 max-h-[calc(100%-16px)] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
              onClick={e => e.stopPropagation()} // don't let panel clicks reach backdrop
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <span className="text-sm font-semibold text-foreground">Edit Website</span>
                <button
                  onClick={() => setShowEditPanel(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
                >
                  ×
                </button>
              </div>

              {/* Tab bar */}
              <div className="flex border-b border-border shrink-0">
                {(['text', 'styles'] as const).map(t => (
                  <button
                    key={t}
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

              {/* Scrollable content */}
              <div className="overflow-y-auto flex-1">
                {/* ── Edit Text tab ─────────────────────────────────────── */}
                {editTab === 'text' && (
                  <div className="p-3 space-y-3">
                    {textEntries.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">
                        No editable text found.<br />Ask AI to build something first.
                      </p>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Edit any field below. Changes apply instantly to the preview.
                        </p>
                        {textEntries.map((entry, i) => (
                          <TextRow
                            key={`${entry.tag}-${entry.text.slice(0, 20)}-${i}`}
                            entry={entry}
                            onApply={applyTextEdit}
                          />
                        ))}
                      </>
                    )}
                  </div>
                )}

                {/* ── Quick Styles tab ──────────────────────────────────── */}
                {editTab === 'styles' && (
                  <div className="py-2">
                    <p className="px-4 py-2 text-xs text-muted-foreground">
                      AI applies the change instantly.
                    </p>
                    {QUICK_EDITS.map(qe => (
                      <button
                        key={qe.label}
                        onClick={() => applyQuickStyle(qe.prompt)}
                        className="w-full text-left px-4 py-2.5 text-xs hover:bg-secondary transition-colors text-foreground flex items-center gap-2 group"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover:bg-primary transition-colors shrink-0" />
                        {qe.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {fullscreen && (
        <div className="absolute top-14 right-4 text-xs text-muted-foreground pointer-events-none">
          Press <kbd className="px-1 py-0.5 bg-secondary rounded text-foreground">Esc</kbd> to exit
        </div>
      )}
    </div>
  )
}
