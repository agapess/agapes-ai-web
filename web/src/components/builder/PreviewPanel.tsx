'use client'
import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview,
  SandpackCodeEditor,
} from '@codesandbox/sandpack-react'
import { useBuilderStore } from '@/store/builderStore'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

// A valid minimal React component — used as the Sandpack file content.
const STARTER_CODE = `export default function App() {
  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#1e1b4b 0%,#4c1d95 100%)',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{textAlign:'center',color:'white',padding:'0 24px'}}>
        <div style={{fontSize:'48px',marginBottom:'16px'}}>✦</div>
        <h1 style={{fontSize:'36px',fontWeight:'bold',marginBottom:'12px'}}>Start building</h1>
        <p style={{color:'#c4b5fd',fontSize:'16px',maxWidth:'360px',margin:'0 auto'}}>Describe your website in the chat and AI will build it for you.</p>
      </div>
    </div>
  )
}`

function isValidCode(s: unknown): s is string {
  if (typeof s !== 'string') return false
  const trimmed = s.trim()
  return trimmed.length > 20 && /export\s+default/.test(trimmed)
}

const PREVIEW_WIDTHS = { desktop: '100%', tablet: '768px', mobile: '375px' }

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
  tag: string
  label: string
  text: string
}

const TAG_LABELS: Record<string, string> = {
  h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3',
  h4: 'Heading 4', h5: 'Heading 5', h6: 'Heading 6',
  p: 'Paragraph', button: 'Button', a: 'Link',
  span: 'Text', li: 'List item', label: 'Label',
  th: 'Table header', td: 'Table cell',
  blockquote: 'Quote', figcaption: 'Caption',
}

function extractTaggedTexts(code: string): TextEntry[] {
  const results: TextEntry[] = []
  const seen = new Set<string>()
  const tagPattern = Object.keys(TAG_LABELS).join('|')
  const re = new RegExp(`<(${tagPattern})[^>]*>\\s*([^<{}\n\r]{1,300}?)\\s*<\\/(?:${tagPattern})>`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(code)) !== null) {
    const tag = m[1]; const raw = m[2].trim()
    if (!raw || raw.length < 1 || /^\{/.test(raw) || /^\d+$/.test(raw) || /^[A-Z_]+$/.test(raw) || seen.has(raw)) continue
    seen.add(raw)
    results.push({ tag, label: TAG_LABELS[tag] ?? tag, text: raw })
  }
  return results
}

// ── Link extraction ───────────────────────────────────────────────────────────
interface LinkEntry {
  /** Display text shown next to the URL input */
  label: string
  /** Current href value (e.g. "#", "https://...") */
  href: string
  /** Unique key for React — the full original href="..." attribute string */
  attrKey: string
}

function extractLinks(code: string): LinkEntry[] {
  const results: LinkEntry[] = []
  const seen = new Set<string>()

  // Match href="..." or href='...' inside JSX
  const hrefRe = /href=["']([^"']*?)["']/g
  // Match the nearest text content before the </a> closing
  let m: RegExpExecArray | null

  while ((m = hrefRe.exec(code)) !== null) {
    const href = m[1]
    const attrKey = m[0]
    if (seen.has(attrKey)) continue
    seen.add(attrKey)

    // Try to find a label — look for text between > and </a> near this match
    const afterAttr = code.slice(m.index)
    const textMatch = afterAttr.match(/>([^<{}\n\r]{1,80}?)<\/a>/)
    const label = textMatch ? textMatch[1].trim() : href || 'Link'

    results.push({ label, href, attrKey })
  }

  return results
}

// ── Text row ──────────────────────────────────────────────────────────────────
const TAG_COLOR: Record<string, string> = {
  h1: 'text-yellow-400', h2: 'text-amber-400', h3: 'text-orange-400',
  h4: 'text-orange-300', p: 'text-blue-400', button: 'text-green-400',
  a: 'text-purple-400', span: 'text-zinc-400',
}

function TextRow({ entry, onApply }: { entry: TextEntry; onApply: (o: string, n: string) => void }) {
  const [value, setValue] = useState(entry.text)
  const savedRef = useRef(entry.text)
  useEffect(() => { setValue(entry.text); savedRef.current = entry.text }, [entry.text])
  function commit() {
    const t = value.trim()
    if (t && t !== savedRef.current) { onApply(savedRef.current, t); savedRef.current = t }
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <span className={`text-[10px] font-mono font-bold ${TAG_COLOR[entry.tag] ?? 'text-muted-foreground'}`}>{`<${entry.tag}>`}</span>
        <span className="text-[10px] text-muted-foreground">{entry.label}</span>
      </div>
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); e.currentTarget.blur() } if (e.key === 'Escape') { setValue(savedRef.current); e.currentTarget.blur() } }}
        className="w-full px-2 py-1.5 text-xs bg-secondary border border-border rounded-md text-foreground focus:outline-none focus:border-primary transition-colors"
      />
    </div>
  )
}

// ── Link row ──────────────────────────────────────────────────────────────────
function LinkRow({ entry, onApply }: { entry: LinkEntry; onApply: (oldAttr: string, newHref: string) => void }) {
  const [value, setValue] = useState(entry.href)
  const savedRef = useRef(entry.href)
  useEffect(() => { setValue(entry.href); savedRef.current = entry.href }, [entry.href])
  function commit() {
    const t = value.trim()
    if (t !== savedRef.current) { onApply(entry.attrKey, t); savedRef.current = t }
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-mono font-bold text-purple-400">&lt;a&gt;</span>
        <span className="text-[10px] text-muted-foreground truncate max-w-[180px]" title={entry.label}>{entry.label}</span>
      </div>
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); e.currentTarget.blur() } if (e.key === 'Escape') { setValue(savedRef.current); e.currentTarget.blur() } }}
        placeholder="https://example.com  or  #section-id"
        className="w-full px-2 py-1.5 text-xs bg-secondary border border-border rounded-md text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-primary transition-colors font-mono"
      />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PreviewPanel() {
  const {
    previewCode, previewSize, previewTheme, setPreviewTheme,
    activePreviewTab, setActivePreviewTab, setPreviewSize,
    setPreviewCode, activePage, project, updatePageContent,
  } = useBuilderStore()

  const [fullscreen, setFullscreen] = useState(false)
  const [containerHeight, setContainerHeight] = useState(0)
  const [showEditPanel, setShowEditPanel] = useState(false)
  const [editTab, setEditTab] = useState<'text' | 'links' | 'styles'>('text')
  const containerRef = useRef<HTMLDivElement>(null)

  const code = isValidCode(previewCode) ? previewCode : STARTER_CODE
  const textEntries = useMemo(() => extractTaggedTexts(code), [code])
  const linkEntries = useMemo(() => extractLinks(code), [code])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') { if (showEditPanel) { setShowEditPanel(false); return } if (fullscreen) setFullscreen(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [fullscreen, showEditPanel])

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => { for (const e of entries) setContainerHeight(e.contentRect.height) })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const sandpackHeight = containerHeight > 0 ? `${containerHeight}px` : '100%'

  /** Persist code changes to preview + DB */
  const saveCode = useCallback((updated: string) => {
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

  const applyTextEdit = useCallback((oldText: string, newText: string) => {
    const escaped = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    saveCode(code.replace(new RegExp(escaped, 'g'), newText))
  }, [code, saveCode])

  /** Replace a specific href="..." attribute string with the new URL */
  const applyLinkEdit = useCallback((oldAttr: string, newHref: string) => {
    // Determine which quote style was used and preserve it
    const quote = oldAttr.includes('"') ? '"' : "'"
    const newAttr = `href=${quote}${newHref}${quote}`
    const escaped = oldAttr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    saveCode(code.replace(new RegExp(escaped, 'g'), newAttr))
  }, [code, saveCode])

  const applyQuickStyle = useCallback((prompt: string) => {
    setShowEditPanel(false)
    window.dispatchEvent(new CustomEvent('quick-edit', { detail: { prompt } }))
  }, [])

  const EDIT_TABS = [
    { key: 'text', label: '✏️ Text' },
    { key: 'links', label: '🔗 Links' },
    { key: 'styles', label: '🎨 Styles' },
  ] as const

  return (
    <div className={`flex flex-col bg-zinc-950 overflow-hidden ${fullscreen ? 'fixed inset-0 z-50' : 'flex-1'}`}>
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-card shrink-0">
        {(['preview', 'code'] as const).map(tab => (
          <button key={tab} onClick={() => setActivePreviewTab(tab)}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${activePreviewTab === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {tab === 'preview' ? 'Preview' : 'Code'}
          </button>
        ))}

        {activePreviewTab === 'preview' && (
          <div className="flex items-center gap-0.5 ml-2 border-l border-border pl-2">
            {([{ key: 'desktop', icon: '🖥', label: 'Desktop' }, { key: 'tablet', icon: '📱', label: 'Tablet' }, { key: 'mobile', icon: '📲', label: 'Mobile' }] as const).map(({ key, icon, label }) => (
              <button key={key} onClick={() => setPreviewSize(key)} title={label}
                className={`px-1.5 py-0.5 text-xs rounded transition-colors ${previewSize === key ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}>
                {icon}
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          {activePreviewTab === 'preview' && (
            <button onClick={() => setShowEditPanel(o => !o)} title="Edit content & styles"
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${showEditPanel ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}>
              <span>✏️</span><span>Edit</span>
            </button>
          )}
          <button onClick={() => setPreviewTheme(previewTheme === 'dark' ? 'light' : 'dark')} title={`Switch to ${previewTheme === 'dark' ? 'light' : 'dark'} mode`}
            className="px-2 py-1 text-xs rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            {previewTheme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button onClick={() => setFullscreen(!fullscreen)} title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
            className="px-2 py-1 text-xs rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            {fullscreen ? '⊠' : '⊞'}
          </button>
        </div>
      </div>

      {/* ── Preview / Code area ───────────────────────────────────────────── */}
      <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden flex justify-center relative">
        <div className="transition-all duration-300" style={{ width: fullscreen ? '100%' : PREVIEW_WIDTHS[previewSize], maxWidth: '100%', height: sandpackHeight }}>
          <SandpackProvider template="react" theme={previewTheme === 'light' ? 'light' : 'dark'}
            files={{ '/App.js': code }} options={{ externalResources: ['https://cdn.tailwindcss.com'] }}>
            <SandpackLayout style={{ height: sandpackHeight, borderRadius: 0 }}>
              {activePreviewTab === 'preview'
                ? <SandpackPreview style={{ height: sandpackHeight }} showOpenInCodeSandbox={false} showNavigator={false} />
                : <SandpackCodeEditor style={{ height: sandpackHeight }} showLineNumbers />}
            </SandpackLayout>
          </SandpackProvider>
        </div>

        {/* ── Edit panel ─────────────────────────────────────────────────── */}
        {showEditPanel && (
          <>
            {/* Backdrop — covers iframe so outside clicks register */}
            <div className="absolute inset-0 z-10" onClick={() => setShowEditPanel(false)} />

            {/* Panel */}
            <div className="absolute top-2 right-2 z-20 w-80 max-h-[calc(100%-16px)] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <span className="text-sm font-semibold text-foreground">Edit Website</span>
                <button onClick={() => setShowEditPanel(false)} className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none">×</button>
              </div>

              {/* Tabs — Text / Links / Styles */}
              <div className="flex border-b border-border shrink-0">
                {EDIT_TABS.map(t => (
                  <button key={t.key} onClick={() => setEditTab(t.key)}
                    className={`flex-1 py-2 text-xs font-medium transition-colors ${editTab === t.key ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1">

                {/* ── Text tab ─────────────────────────────────────── */}
                {editTab === 'text' && (
                  <div className="p-3 space-y-3">
                    {textEntries.length === 0
                      ? <p className="text-xs text-muted-foreground text-center py-8">No editable text found.<br />Ask AI to build something first.</p>
                      : <>
                          <p className="text-xs text-muted-foreground">Edit any field. Press Enter or click away to apply.</p>
                          {textEntries.map((entry, i) => (
                            <TextRow key={`${entry.tag}-${entry.text.slice(0, 20)}-${i}`} entry={entry} onApply={applyTextEdit} />
                          ))}
                        </>
                    }
                  </div>
                )}

                {/* ── Links tab ────────────────────────────────────── */}
                {editTab === 'links' && (
                  <div className="p-3 space-y-3">
                    {linkEntries.length === 0
                      ? <p className="text-xs text-muted-foreground text-center py-8">No links found.<br />Links in your page appear here so you can set real URLs.</p>
                      : <>
                          <p className="text-xs text-muted-foreground">
                            Set the destination for each link. Use <code className="bg-secondary px-1 rounded">#section-id</code> for same-page anchors or a full URL.
                          </p>
                          {linkEntries.map((entry, i) => (
                            <LinkRow key={`${entry.attrKey}-${i}`} entry={entry} onApply={applyLinkEdit} />
                          ))}
                        </>
                    }
                  </div>
                )}

                {/* ── Styles tab ───────────────────────────────────── */}
                {editTab === 'styles' && (
                  <div className="py-2">
                    <p className="px-4 py-2 text-xs text-muted-foreground">AI applies the change instantly.</p>
                    {QUICK_EDITS.map(qe => (
                      <button key={qe.label} onClick={() => applyQuickStyle(qe.prompt)}
                        className="w-full text-left px-4 py-2.5 text-xs hover:bg-secondary transition-colors text-foreground flex items-center gap-2 group">
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
