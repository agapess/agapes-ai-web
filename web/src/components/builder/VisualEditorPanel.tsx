'use client'
import { useCallback, useState, useRef, useEffect } from 'react'
import { useBuilderStore } from '@/store/builderStore'
import { swapTailwindClass, replaceText } from '@/lib/tailwindMutator'

// ── Image picker sub-component ────────────────────────────────────────────────
function ImagePicker({
  code,
  tagName,
  className,
  onSave,
  projectId,
}: {
  code: string
  tagName: string
  className: string
  onSave: (updated: string) => void
  projectId: string
}) {
  const [images, setImages] = useState<Array<{ url: string; filename: string }>>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/upload/${projectId}`)
      .then(r => r.json())
      .then(d => setImages(d.images ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [projectId])

  async function upload(files: FileList | null) {
    if (!files) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      try {
        const res = await fetch(`/api/upload/${projectId}`, { method: 'POST', body: fd })
        if (res.ok) {
          const data = await res.json()
          setImages(prev => [{ url: data.url, filename: data.filename }, ...prev])
        }
      } catch { /* ignore */ }
    }
    setUploading(false)
  }

  /** Replace the src attribute on the selected <img> tag */
  function applySrc(newSrc: string) {
    // Find the <img> by className
    const needle1 = `className="${className}"`
    const needle2 = `className='${className}'`
    let tagStart = -1
    for (const needle of [needle1, needle2]) {
      let pos = code.indexOf(needle)
      while (pos >= 0) {
        let ts = pos
        while (ts > 0 && code[ts] !== '<') ts--
        const after = code.slice(ts + 1)
        if (after.startsWith(tagName) && /[\s>/]/.test(after[tagName.length])) {
          tagStart = ts; break
        }
        pos = code.indexOf(needle, pos + 1)
      }
      if (tagStart >= 0) break
    }
    if (tagStart < 0) return

    // Find end of this self-closing tag
    let i = tagStart + 1
    let braceDepth = 0
    while (i < code.length) {
      const ch = code[i]
      if (ch === '{') braceDepth++
      else if (ch === '}') braceDepth--
      else if (ch === '>' && braceDepth === 0) { i++; break }
      i++
    }
    const openTag = code.slice(tagStart, i)
    let newOpenTag: string
    if (/\bsrc=["'][^"']*["']/.test(openTag)) {
      newOpenTag = openTag.replace(/\bsrc=["'][^"']*["']/, `src="${newSrc}"`)
    } else {
      newOpenTag = openTag.replace(/^<img/, `<img src="${newSrc}"`)
    }
    onSave(code.slice(0, tagStart) + newOpenTag + code.slice(i))
  }

  return (
    <div className="rounded-lg border border-purple-500/40 bg-purple-500/5 p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-purple-400">🖼</span>
          <span className="text-[10px] font-semibold text-purple-300 uppercase tracking-wide">Image Source</span>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-[10px] px-2 py-0.5 bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors disabled:opacity-50"
        >
          {uploading ? '↻ Uploading…' : '+ Upload'}
        </button>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => upload(e.target.files)} />
      {loading ? (
        <p className="text-[10px] text-muted-foreground text-center py-2">Loading…</p>
      ) : images.length === 0 ? (
        <p className="text-[10px] text-muted-foreground text-center py-2">No images yet. Upload one above.</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
          {images.map(img => (
            <button key={img.url} onClick={() => applySrc(img.url)} title={img.filename}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.filename} className="w-full aspect-square object-cover rounded border border-border hover:border-purple-400 transition-colors" />
            </button>
          ))}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground/60">Click a photo to replace this image.</p>
    </div>
  )
}

// Tags that can meaningfully have a hyperlink set on them
const LINKABLE_TAGS = ['a', 'button', 'span', 'div', 'li']

// ── Robust character-level tag scanner ───────────────────────────────────────

/**
 * Given an index pointing at '<' in code, find the index just past the
 * closing '>' of the opening tag — respecting { } brace nesting so that
 * JSX expressions like className={x > 0 ? 'a' : 'b'} don't fool us.
 */
function findOpenTagEnd(code: string, tagStart: number): number {
  let i = tagStart + 1
  let braceDepth = 0
  while (i < code.length) {
    const ch = code[i]
    if (ch === '{') braceDepth++
    else if (ch === '}') braceDepth--
    else if (ch === '>' && braceDepth === 0) return i + 1
    i++
  }
  return code.length
}

/**
 * Find the start index of the first occurrence of a JSX opening tag that
 * contains className="<literal>". Returns -1 if not found.
 * Uses a plain string search rather than regex so special chars in className
 * (like / [ ] etc.) don't need escaping.
 */
function findTagByClass(code: string, tagName: string, className: string): number {
  // Search for `className="<className>"` or `className='<className>'`
  const needle1 = `className="${className}"`
  const needle2 = `className='${className}'`

  for (const needle of [needle1, needle2]) {
    let pos = code.indexOf(needle)
    while (pos >= 0) {
      // Walk back to find the opening '<'
      let tagStart = pos
      while (tagStart > 0 && code[tagStart] !== '<') tagStart--
      // Check the tag name matches
      const afterLt = code.slice(tagStart + 1)
      if (afterLt.startsWith(tagName) && /[\s>/]/.test(afterLt[tagName.length])) {
        return tagStart
      }
      pos = code.indexOf(needle, pos + 1)
    }
  }
  return -1
}

/**
 * Extract the href value from the opening tag at tagStart.
 * Returns '' if no href attribute found.
 */
function extractHrefFromTag(openTag: string): string {
  const m = openTag.match(/\bhref=["']([^"']*)["']/)
  return m ? m[1] : ''
}

/**
 * Extract the current href for the element identified by tagName + className.
 */
function extractHref(code: string, tagName: string, className: string): string {
  const tagStart = findTagByClass(code, tagName, className)
  if (tagStart < 0) return ''
  const tagEnd = findOpenTagEnd(code, tagStart)
  const openTag = code.slice(tagStart, tagEnd)
  return extractHrefFromTag(openTag)
}

/**
 * Find the matching closing </tagName> for an element whose opening tag ends at
 * contentStart, using depth counting across ALL tags (not just same-name).
 * Returns the index just past the '>' of the closing tag.
 */
function findMatchingClose(code: string, contentStart: number): number {
  let depth = 0
  let i = contentStart
  while (i < code.length) {
    if (code[i] !== '<') { i++; continue }
    if (code[i + 1] === '/') {
      if (depth === 0) return code.indexOf('>', i) + 1
      depth--
      i = code.indexOf('>', i) + 1
    } else if (/[A-Za-z]/.test(code[i + 1])) {
      const gt = findOpenTagEnd(code, i)
      if (code[gt - 2] !== '/') depth++   // not self-closing
      i = gt
    } else {
      i++
    }
  }
  return code.length
}

/**
 * Safely set the href on any JSX element.
 *
 * Strategy:
 *   • <a>   → replace/add href="..." on the opening tag
 *   • other → wrap the entire element in <a href="...">…</a>
 *
 * Uses character-level scanning so nested braces in JSX expressions
 * (e.g. onClick={() => setState(x => x+1)}) never confuse the parser.
 */
function applyHrefToCode(code: string, tagName: string, className: string, href: string): string {
  const tagStart = findTagByClass(code, tagName, className)
  if (tagStart < 0) return code   // element not found — leave code unchanged

  const tagEnd = findOpenTagEnd(code, tagStart)
  const openTag = code.slice(tagStart, tagEnd)

  if (tagName === 'a') {
    // Replace or insert href on the <a> tag
    let newOpenTag: string
    if (/\bhref=["'][^"']*["']/.test(openTag)) {
      newOpenTag = openTag.replace(/\bhref=["'][^"']*["']/, `href="${href}"`)
    } else {
      // Insert href right after "<a"
      newOpenTag = openTag.replace(/^<a(\s|>)/, `<a href="${href}"$1`)
    }
    return code.slice(0, tagStart) + newOpenTag + code.slice(tagEnd)
  }

  // For all other tags (button, span, div, li, etc.) — wrap the whole element in <a>
  const isSelfClosing = openTag.trimEnd().endsWith('/>')
  if (isSelfClosing) {
    // <input />, <img /> etc. — wrap the single tag
    return (
      code.slice(0, tagStart) +
      `<a href="${href}" target="_blank" rel="noopener noreferrer">` +
      openTag +
      `</a>` +
      code.slice(tagEnd)
    )
  }

  // Find the matching closing tag
  const closeEnd = findMatchingClose(code, tagEnd)
  const inner = code.slice(tagStart, closeEnd)   // full element including closing tag

  return (
    code.slice(0, tagStart) +
    `<a href="${href}" target="_blank" rel="noopener noreferrer">` +
    inner +
    `</a>` +
    code.slice(closeEnd)
  )
}

// ── Link editor sub-component ─────────────────────────────────────────────────
function LinkEditor({
  tagName,
  className,
  code,
  onSave,
}: {
  tagName: string
  className: string
  code: string
  onSave: (updated: string) => void
}) {
  const current = extractHref(code, tagName, className)
  const [value, setValue] = useState(current)
  const inputRef = useRef<HTMLInputElement>(null)

  // Re-sync if selection changes
  useEffect(() => {
    const fresh = extractHref(code, tagName, className)
    setValue(fresh)
  }, [tagName, className, code])

  function apply(url: string) {
    const trimmed = url.trim()
    if (!trimmed) return
    const updated = applyHrefToCode(code, tagName, className, trimmed)
    onSave(updated)
  }

  return (
    <div className="rounded-lg border border-indigo-500/40 bg-indigo-500/5 p-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-indigo-400">🔗</span>
        <span className="text-[10px] font-semibold text-indigo-300 uppercase tracking-wide">Hyperlink / URL</span>
      </div>
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={e => apply(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { apply(value); e.currentTarget.blur() }
          if (e.key === 'Escape') { setValue(current); e.currentTarget.blur() }
        }}
        placeholder="https://example.com  or  #section-id"
        className="w-full px-2 py-1.5 text-xs bg-secondary border border-border rounded text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-indigo-400 font-mono"
      />
      <div className="flex gap-1.5 flex-wrap">
        {['#contact', '#features', '#pricing', 'https://'].map(hint => (
          <button key={hint} onClick={() => setValue(hint)}
            className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-indigo-400/50 transition-colors">
            {hint}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground/60">
        {tagName === 'a' ? 'Sets the href attribute.' : tagName === 'button' ? 'Opens URL in new tab on click.' : 'Wraps content in a link.'}
      </p>
    </div>
  )
}

// ── Tailwind palette with hex values (for color swatches) ────────────────────
// Keys match Tailwind color names; values are hex per shade.

const COLORS = ['red','orange','amber','yellow','lime','green','emerald','teal','cyan','sky','blue','indigo','violet','purple','fuchsia','pink','rose','gray','zinc','slate'] as const
type Color = typeof COLORS[number]

// Approximate Tailwind hex values for shades 300-700
const COLOR_HEX: Record<Color, Record<string, string>> = {
  red:      { '300':'#fca5a5','400':'#f87171','500':'#ef4444','600':'#dc2626','700':'#b91c1c' },
  orange:   { '300':'#fdba74','400':'#fb923c','500':'#f97316','600':'#ea580c','700':'#c2410c' },
  amber:    { '300':'#fcd34d','400':'#fbbf24','500':'#f59e0b','600':'#d97706','700':'#b45309' },
  yellow:   { '300':'#fde047','400':'#facc15','500':'#eab308','600':'#ca8a04','700':'#a16207' },
  lime:     { '300':'#bef264','400':'#a3e635','500':'#84cc16','600':'#65a30d','700':'#4d7c0f' },
  green:    { '300':'#86efac','400':'#4ade80','500':'#22c55e','600':'#16a34a','700':'#15803d' },
  emerald:  { '300':'#6ee7b7','400':'#34d399','500':'#10b981','600':'#059669','700':'#047857' },
  teal:     { '300':'#5eead4','400':'#2dd4bf','500':'#14b8a6','600':'#0d9488','700':'#0f766e' },
  cyan:     { '300':'#67e8f9','400':'#22d3ee','500':'#06b6d4','600':'#0891b2','700':'#0e7490' },
  sky:      { '300':'#7dd3fc','400':'#38bdf8','500':'#0ea5e9','600':'#0284c7','700':'#0369a1' },
  blue:     { '300':'#93c5fd','400':'#60a5fa','500':'#3b82f6','600':'#2563eb','700':'#1d4ed8' },
  indigo:   { '300':'#a5b4fc','400':'#818cf8','500':'#6366f1','600':'#4f46e5','700':'#4338ca' },
  violet:   { '300':'#c4b5fd','400':'#a78bfa','500':'#8b5cf6','600':'#7c3aed','700':'#6d28d9' },
  purple:   { '300':'#d8b4fe','400':'#c084fc','500':'#a855f7','600':'#9333ea','700':'#7e22ce' },
  fuchsia:  { '300':'#f0abfc','400':'#e879f9','500':'#d946ef','600':'#c026d3','700':'#a21caf' },
  pink:     { '300':'#f9a8d4','400':'#f472b6','500':'#ec4899','600':'#db2777','700':'#be185d' },
  rose:     { '300':'#fda4af','400':'#fb7185','500':'#f43f5e','600':'#e11d48','700':'#be123c' },
  gray:     { '300':'#d1d5db','400':'#9ca3af','500':'#6b7280','600':'#4b5563','700':'#374151' },
  zinc:     { '300':'#d4d4d8','400':'#a1a1aa','500':'#71717a','600':'#52525b','700':'#3f3f46' },
  slate:    { '300':'#cbd5e1','400':'#94a3b8','500':'#64748b','600':'#475569','700':'#334155' },
}

const SHADES = ['300','400','500','600','700'] as const

// ── Property constants ────────────────────────────────────────────────────────

const FONT_SIZES = ['xs','sm','base','lg','xl','2xl','3xl','4xl','5xl','6xl']
const FONT_WEIGHTS = ['normal','medium','semibold','bold','black']
const PADDINGS = ['0','1','2','3','4','5','6','8','10','12','16']
const RADII = ['','sm','md','lg','xl','2xl','full']
const RADIUS_LABELS = ['None','SM','MD','LG','XL','2XL','Full']
const TEXT_TAGS = ['h1','h2','h3','h4','h5','h6','p','button','a','span','li','label']

// ── Color picker sub-component ────────────────────────────────────────────────

function ColorPicker({ label, onSelect }: { label: string; onSelect: (cls: string) => void }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">{label}</p>
      <div className="space-y-0.5">
        {/* White / Black row */}
        <div className="flex gap-1 mb-1.5">
          {[
            { title: 'white', hex: '#ffffff' },
            { title: 'black', hex: '#000000' },
            { title: 'transparent', hex: 'transparent' },
          ].map(c => (
            <button key={c.title} title={c.title}
              onClick={() => onSelect(c.title)}
              style={{ width: 18, height: 18, background: c.hex, border: '1px solid rgba(255,255,255,0.2)', borderRadius: 3 }}
            />
          ))}
        </div>
        {/* Color grid */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLORS.length}, 1fr)`, gap: 2 }}>
          {SHADES.map(shade =>
            COLORS.map(color => {
              const hex = COLOR_HEX[color]?.[shade] ?? '#888'
              return (
                <button key={`${color}-${shade}`} title={`${color}-${shade}`}
                  onClick={() => onSelect(`${color}-${shade}`)}
                  style={{ width: 12, height: 12, background: hex, borderRadius: 2, border: 'none', cursor: 'pointer' }}
                  className="hover:scale-125 transition-transform"
                />
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function VisualEditorPanel() {
  const {
    selectedElement, setSelectedElement,
    previewCode, setPreviewCode,
    activePage, project, updatePageContent,
  } = useBuilderStore()

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
  }, [setPreviewCode, activePage, project, updatePageContent])

  if (!selectedElement) {
    return (
      <div className="p-4 space-y-3 text-center">
        <p className="text-xs text-muted-foreground">
          Click any element in the preview to edit its properties.
        </p>
        <p className="text-[10px] text-muted-foreground/60">
          Drag the indigo handle at the top of each section to reorder it.
        </p>
        <p className="text-[10px] text-muted-foreground/60">
          Use the <strong>×</strong> button to delete a section, and the <strong>+</strong> to add one.
        </p>
      </div>
    )
  }

  // Capture non-null reference for use in nested functions
  const el = selectedElement
  const { tagName, className, textContent } = el
  const code = previewCode
  const isLiteralClass = typeof className === 'string' && !className.includes('{')

  function mutate(prefix: string, newValue: string, mode: 'color' | 'size' | 'any' = 'any') {
    if (!isLiteralClass) return
    const updated = swapTailwindClass(code, tagName, className, prefix, newValue, mode)
    saveCode(updated)
  }

  function mutateText(newText: string) {
    if (!textContent) return
    const updated = replaceText(code, textContent, newText)
    saveCode(updated)
    setSelectedElement({ bid: el.bid, tagName: el.tagName, className: el.className, rect: el.rect, sectionBid: el.sectionBid, textContent: newText })
  }

  function currentHas(cls: string) {
    return className.split(' ').includes(cls)
  }

  const isTextEl = TEXT_TAGS.includes(tagName)
  const isLinkable = LINKABLE_TAGS.includes(tagName)
  const isImg = tagName === 'img'

  return (
    <div className="p-3 space-y-4 text-xs overflow-y-auto">
      {/* Element badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono bg-secondary px-2 py-0.5 rounded text-primary text-[10px]">
          &lt;{tagName}&gt;
        </span>
        {!isLiteralClass && (
          <span className="text-amber-400 text-[10px]">dynamic className — limited editing</span>
        )}
        <button
          onClick={() => setSelectedElement(null)}
          className="ml-auto text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          ✕ Deselect
        </button>
      </div>

      {/* Image source picker — shown when an <img> is selected */}
      {isImg && project && (
        <ImagePicker
          code={code}
          tagName={tagName}
          className={className}
          onSave={saveCode}
          projectId={project.id}
        />
      )}

      {/* Link / URL editor — shown for a, button, span, div, li */}
      {isLinkable && (
        <LinkEditor
          tagName={tagName}
          className={className}
          code={code}
          onSave={saveCode}
        />
      )}

      {/* Text */}
      {isTextEl && textContent && (
        <div>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 block">Text Content</label>
          <input
            key={textContent}
            defaultValue={textContent}
            onBlur={e => mutateText(e.target.value.trim())}
            onKeyDown={e => { if (e.key === 'Enter') { mutateText((e.target as HTMLInputElement).value.trim()); e.currentTarget.blur() } }}
            className="w-full px-2 py-1.5 bg-secondary border border-border rounded text-foreground focus:outline-none focus:border-primary text-xs"
          />
        </div>
      )}

      {isLiteralClass && (
        <>
          {/* Background color */}
          <ColorPicker label="Background" onSelect={v => {
            const cls = v === 'white' || v === 'black' || v === 'transparent' ? `bg-${v}` : `bg-${v}`
            mutate('bg-', cls, 'any')
          }} />

          {/* Text color */}
          <ColorPicker label="Text Color" onSelect={v => {
            const cls = v === 'white' || v === 'black' || v === 'transparent' ? `text-${v}` : `text-${v}`
            mutate('text-', cls, 'color')
          }} />

          {/* Font size */}
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 block">Font Size</label>
            <div className="flex flex-wrap gap-1">
              {FONT_SIZES.map(s => (
                <button key={s} onClick={() => mutate('text-', `text-${s}`, 'size')}
                  className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${currentHas(`text-${s}`) ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Font weight */}
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 block">Font Weight</label>
            <div className="flex flex-wrap gap-1">
              {FONT_WEIGHTS.map(w => (
                <button key={w} onClick={() => mutate('font-', `font-${w}`)}
                  className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${currentHas(`font-${w}`) ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40'}`}>
                  {w}
                </button>
              ))}
            </div>
          </div>

          {/* Text align */}
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 block">Text Align</label>
            <div className="flex gap-1">
              {[['left','←'],['center','↔'],['right','→']] .map(([a, icon]) => (
                <button key={a} onClick={() => mutate('text-', `text-${a}`, 'any')}
                  className={`flex-1 py-1 rounded text-[10px] border transition-colors ${currentHas(`text-${a}`) ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                  {icon} {a}
                </button>
              ))}
            </div>
          </div>

          {/* Padding */}
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 block">Padding (all sides)</label>
            <div className="flex flex-wrap gap-1">
              {PADDINGS.map(p => (
                <button key={p} onClick={() => mutate('p-', p === '0' ? 'p-0' : `p-${p}`)}
                  className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${currentHas(`p-${p}`) ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Border radius */}
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 block">Border Radius</label>
            <div className="flex flex-wrap gap-1">
              {RADII.map((r, i) => {
                const cls = r ? `rounded-${r}` : 'rounded'
                return (
                  <button key={r || 'base'} onClick={() => mutate('rounded', cls)}
                    className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${currentHas(cls) ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40'}`}>
                    {RADIUS_LABELS[i]}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
