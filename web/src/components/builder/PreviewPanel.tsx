'use client'
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview,
  SandpackCodeEditor,
} from '@codesandbox/sandpack-react'
import { useBuilderStore } from '@/store/builderStore'
import { reorderSections, deleteSection, insertSectionAfter } from '@/lib/jsxSectionParser'
import { swapTailwindClass, replaceText } from '@/lib/tailwindMutator'

// ── Sandpack starter code ─────────────────────────────────────────────────────

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
  return s.trim().length > 20 && /export\s+default/.test(s)
}

const PREVIEW_WIDTHS = { desktop: '100%', tablet: '768px', mobile: '375px' }

// ── Builder bridge (injected into Sandpack iframe in visual mode) ──────────────

const BUILDER_BRIDGE_JS = `
let idCounter = 0;
const ATTR = 'data-bid';
let selectedBid = null;
let styleEl = null;
let dragBid = null;
let dragOverBid = null;

function ensureStyle() {
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = '__builder_styles';
    document.head.appendChild(styleEl);
  }
}

export function assignIds() {
  document.querySelectorAll('body *').forEach(function(el) {
    if (!el.hasAttribute(ATTR)) el.setAttribute(ATTR, String(++idCounter));
  });
}

export function highlightElement(bid) {
  ensureStyle();
  selectedBid = bid;
  styleEl.textContent = bid
    ? '[' + ATTR + '="' + bid + '"] { outline: 2px solid #6366f1 !important; outline-offset: 2px !important; cursor: pointer !important; }'
    : '';
}

function getTopLevelSectionBid(el) {
  var root = document.body.firstElementChild;
  if (!root) return null;
  var cur = el;
  while (cur && cur.parentElement !== root) {
    cur = cur.parentElement;
    if (!cur || cur === document.body) return null;
  }
  return cur ? cur.getAttribute(ATTR) : null;
}

export function reportSections() {
  var root = document.body.firstElementChild;
  if (!root) return;
  var secs = [];
  Array.from(root.children).forEach(function(el, i) {
    if (el.hasAttribute('data-drag-handle-injected')) return;
    var rect = el.getBoundingClientRect();
    secs.push({ bid: el.getAttribute(ATTR), index: i, rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height } });
  });
  window.parent.postMessage({ type: 'builder:sections-report', sections: secs }, '*');
}

export function injectDragHandles() {
  var root = document.body.firstElementChild;
  if (!root) return;
  Array.from(root.children).forEach(function(section) {
    if (section.getAttribute('data-drag-handle-injected')) return;
    section.setAttribute('data-drag-handle-injected', 'true');
    var bid = section.getAttribute(ATTR);
    var handle = document.createElement('div');
    handle.setAttribute('data-drag-handle', bid || '');
    handle.title = 'Drag to reorder section';
    handle.style.cssText = [
      'position:absolute','top:6px','left:50%','transform:translateX(-50%)',
      'width:40px','height:5px','background:rgba(99,102,241,0.45)',
      'border-radius:3px','cursor:grab','z-index:9999',
      'transition:background 0.15s',
    ].join(';');
    handle.addEventListener('mouseenter', function() { handle.style.background = 'rgba(99,102,241,0.95)'; });
    handle.addEventListener('mouseleave', function() { handle.style.background = 'rgba(99,102,241,0.45)'; });
    var pos = window.getComputedStyle(section).position;
    if (pos === 'static') section.style.position = 'relative';
    section.appendChild(handle);
  });
}

export function attachListeners() {
  document.addEventListener('click', function(e) {
    var el = e.target;
    var bid = el.getAttribute && el.getAttribute(ATTR);
    if (!bid) return;
    var rect = el.getBoundingClientRect();
    window.parent.postMessage({
      type: 'builder:click',
      bid: bid,
      tagName: el.tagName.toLowerCase(),
      className: typeof el.className === 'string' ? el.className : '',
      textContent: (el.textContent || '').slice(0, 200),
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      sectionBid: getTopLevelSectionBid(el),
    }, '*');
  }, true);

  document.addEventListener('mousedown', function(e) {
    var handleBid = e.target.getAttribute && e.target.getAttribute('data-drag-handle');
    if (!handleBid) return;
    dragBid = handleBid;
    e.preventDefault();
    window.parent.postMessage({ type: 'builder:drag-start', bid: dragBid }, '*');
  });

  document.addEventListener('mousemove', function(e) {
    if (!dragBid) return;
    var els = document.elementsFromPoint(e.clientX, e.clientY);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.getAttribute('data-drag-handle')) continue;
      var sectionBid = getTopLevelSectionBid(el);
      if (sectionBid && sectionBid !== dragBid && sectionBid !== dragOverBid) {
        dragOverBid = sectionBid;
        window.parent.postMessage({ type: 'builder:drag-over', overBid: dragOverBid }, '*');
        break;
      }
    }
  });

  document.addEventListener('mouseup', function() {
    if (dragBid) {
      window.parent.postMessage({ type: 'builder:drag-drop', fromBid: dragBid, toBid: dragOverBid }, '*');
      dragBid = null; dragOverBid = null;
    }
  });

  window.addEventListener('message', function(e) {
    var msg = e.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'builder:highlight') highlightElement(msg.bid);
    if (msg.type === 'builder:clear') { highlightElement(null); }
    if (msg.type === 'builder:assign-ids') { assignIds(); reportSections(); injectDragHandles(); }
  });
}

export function watchForRenders() {
  new MutationObserver(function() {
    assignIds();
    if (selectedBid) highlightElement(selectedBid);
    reportSections();
    injectDragHandles();
  }).observe(document.body, { childList: true, subtree: true });
}
`

const BUILDER_INDEX_JS = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App';
import { assignIds, attachListeners, watchForRenders } from './builder-bridge.js';
var root = createRoot(document.getElementById('root'));
root.render(React.createElement(App));
requestAnimationFrame(function() {
  assignIds();
  attachListeners();
  watchForRenders();
  window.parent.postMessage({ type: 'builder:ready' }, '*');
});
`

// ── Quick-edit style presets ──────────────────────────────────────────────────

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

// ── Quick section templates for the + button ──────────────────────────────────

const QUICK_SECTIONS = [
  {
    label: 'Hero',
    source: `<section className="py-20 px-6 text-center bg-gradient-to-br from-indigo-900 to-purple-900">
  <h1 className="text-5xl font-bold text-white mb-4">Your Headline</h1>
  <p className="text-xl text-indigo-200 mb-8 max-w-2xl mx-auto">Describe what you offer here.</p>
  <button className="px-8 py-3 bg-white text-indigo-900 rounded-lg font-semibold hover:bg-indigo-50 transition-colors">Get Started</button>
</section>`,
  },
  {
    label: 'Features',
    source: `<section className="py-16 px-6 bg-zinc-900">
  <h2 className="text-3xl font-bold text-white text-center mb-12">Features</h2>
  <div className="grid grid-cols-3 gap-8 max-w-4xl mx-auto">
    <div className="bg-zinc-800 rounded-xl p-6"><div className="text-3xl mb-3">⚡</div><h3 className="font-semibold text-white mb-2">Fast</h3><p className="text-zinc-400 text-sm">Lightning performance.</p></div>
    <div className="bg-zinc-800 rounded-xl p-6"><div className="text-3xl mb-3">🛡</div><h3 className="font-semibold text-white mb-2">Secure</h3><p className="text-zinc-400 text-sm">Enterprise-grade security.</p></div>
    <div className="bg-zinc-800 rounded-xl p-6"><div className="text-3xl mb-3">✨</div><h3 className="font-semibold text-white mb-2">Simple</h3><p className="text-zinc-400 text-sm">Easy to use.</p></div>
  </div>
</section>`,
  },
  {
    label: 'CTA',
    source: `<section className="py-20 px-6 text-center bg-indigo-600">
  <h2 className="text-4xl font-bold text-white mb-4">Ready to start?</h2>
  <p className="text-indigo-200 text-lg mb-8">Join thousands of happy customers.</p>
  <button className="px-10 py-4 bg-white text-indigo-600 rounded-xl font-bold text-lg hover:bg-indigo-50 transition-colors">Get Started Free</button>
</section>`,
  },
  {
    label: 'Footer',
    source: `<footer className="bg-zinc-950 border-t border-zinc-800 py-12 px-6">
  <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
    <span className="text-white font-bold text-xl">Brand</span>
    <div className="flex gap-6 text-sm text-zinc-400">
      <a href="#" className="hover:text-white transition-colors">Privacy</a>
      <a href="#" className="hover:text-white transition-colors">Terms</a>
      <a href="#" className="hover:text-white transition-colors">Contact</a>
    </div>
    <p className="text-zinc-500 text-sm">© 2025 Brand Inc.</p>
  </div>
</footer>`,
  },
]

// ── Tag-aware text extraction (for Edit panel) ────────────────────────────────

interface TextEntry { tag: string; label: string; text: string }

const TAG_LABELS: Record<string, string> = {
  h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3', h4: 'Heading 4',
  h5: 'Heading 5', h6: 'Heading 6', p: 'Paragraph', button: 'Button',
  a: 'Link', span: 'Text', li: 'List item', label: 'Label',
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
    if (!raw || /^\{/.test(raw) || /^\d+$/.test(raw) || /^[A-Z_]+$/.test(raw) || seen.has(raw)) continue
    seen.add(raw)
    results.push({ tag, label: TAG_LABELS[tag] ?? tag, text: raw })
  }
  return results
}

interface LinkEntry { label: string; href: string; attrKey: string }

function extractLinks(code: string): LinkEntry[] {
  const results: LinkEntry[] = []
  const seen = new Set<string>()
  const hrefRe = /href=["']([^"']*?)["']/g
  let m: RegExpExecArray | null
  while ((m = hrefRe.exec(code)) !== null) {
    const href = m[1]; const attrKey = m[0]
    if (seen.has(attrKey)) continue; seen.add(attrKey)
    const afterAttr = code.slice(m.index)
    const textMatch = afterAttr.match(/>([^<{}\n\r]{1,80}?)<\/a>/)
    const label = textMatch ? textMatch[1].trim() : href || 'Link'
    results.push({ label, href, attrKey })
  }
  return results
}

// ── Sub-components ────────────────────────────────────────────────────────────

const TAG_COLOR: Record<string, string> = {
  h1: 'text-yellow-400', h2: 'text-amber-400', h3: 'text-orange-400',
  p: 'text-blue-400', button: 'text-green-400', a: 'text-purple-400',
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
      <input value={value} onChange={e => setValue(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); e.currentTarget.blur() } if (e.key === 'Escape') { setValue(savedRef.current); e.currentTarget.blur() } }}
        className="w-full px-2 py-1.5 text-xs bg-secondary border border-border rounded-md text-foreground focus:outline-none focus:border-primary transition-colors" />
    </div>
  )
}

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
      <input value={value} onChange={e => setValue(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); e.currentTarget.blur() } if (e.key === 'Escape') { setValue(savedRef.current); e.currentTarget.blur() } }}
        placeholder="https://example.com or #section-id"
        className="w-full px-2 py-1.5 text-xs bg-secondary border border-border rounded-md text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-primary transition-colors font-mono" />
    </div>
  )
}

function AddSectionButton({ afterIndex, top, left, onAdd }: { afterIndex: number; top: number; left: number; onAdd: (src: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'absolute', top: top - 12, left, transform: 'translateX(-50%)', pointerEvents: 'all', zIndex: 30 }}>
      <button onClick={() => setOpen(o => !o)}
        className="w-6 h-6 rounded-full bg-primary text-white text-sm leading-none flex items-center justify-center shadow-lg hover:bg-primary/80 transition-colors"
        title="Add section here">+</button>
      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 top-7 bg-card border border-border rounded-lg shadow-xl w-40 overflow-hidden z-40">
          {QUICK_SECTIONS.map(s => (
            <button key={s.label} onClick={() => { onAdd(s.source); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-secondary text-foreground transition-colors">
              + {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Section rect type ─────────────────────────────────────────────────────────

interface SectionEntry {
  bid: string | null
  index: number
  rect: { top: number; left: number; width: number; height: number }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PreviewPanel() {
  const {
    previewCode, previewSize, previewTheme, setPreviewTheme,
    activePreviewTab, setActivePreviewTab, setPreviewSize,
    setPreviewCode, activePage, project, updatePageContent,
    visualEditMode, setVisualEditMode, selectedElement, setSelectedElement,
  } = useBuilderStore()

  const [fullscreen, setFullscreen] = useState(false)
  const [containerHeight, setContainerHeight] = useState(0)
  const [showEditPanel, setShowEditPanel] = useState(false)
  const [editTab, setEditTab] = useState<'text' | 'links' | 'styles'>('text')
  const [sectionBidMap, setSectionBidMap] = useState<SectionEntry[]>([])
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const code = isValidCode(previewCode) ? previewCode : STARTER_CODE
  const textEntries = useMemo(() => extractTaggedTexts(code), [code])
  const linkEntries = useMemo(() => extractLinks(code), [code])

  // ── Persist code changes ──────────────────────────────────────────────────
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

  // ── Send command to Sandpack iframe ───────────────────────────────────────
  const sendToIframe = useCallback((msg: object) => {
    const iframe = document.querySelector<HTMLIFrameElement>('iframe[data-sandpack="preview"]')
    iframe?.contentWindow?.postMessage(msg, '*')
  }, [])

  // ── Bridge message listener ───────────────────────────────────────────────
  useEffect(() => {
    if (!visualEditMode) return
    function handleMsg(e: MessageEvent) {
      const msg = e.data as Record<string, unknown>
      if (typeof msg?.type !== 'string' || !msg.type.startsWith('builder:')) return

      if (msg.type === 'builder:ready') {
        sendToIframe({ type: 'builder:assign-ids' })
      }

      if (msg.type === 'builder:sections-report') {
        const sections = msg.sections as SectionEntry[]
        const iframe = document.querySelector<HTMLIFrameElement>('iframe[data-sandpack="preview"]')
        const iframeRect = iframe?.getBoundingClientRect()
        const containerRect = containerRef.current?.getBoundingClientRect()
        if (!iframeRect || !containerRect) { setSectionBidMap(sections); return }
        const adjusted = sections.map(s => ({
          ...s,
          rect: {
            top: s.rect.top + (iframeRect.top - containerRect.top),
            left: s.rect.left + (iframeRect.left - containerRect.left),
            width: s.rect.width,
            height: s.rect.height,
          },
        }))
        setSectionBidMap(adjusted)
      }

      if (msg.type === 'builder:click') {
        setSelectedElement({
          bid: String(msg.bid ?? ''),
          tagName: String(msg.tagName ?? ''),
          className: String(msg.className ?? ''),
          textContent: String(msg.textContent ?? ''),
          rect: msg.rect as { top: number; left: number; width: number; height: number },
          sectionBid: msg.sectionBid ? String(msg.sectionBid) : null,
        })
        sendToIframe({ type: 'builder:highlight', bid: msg.bid })
      }

      if (msg.type === 'builder:drag-drop') {
        const fromIdx = sectionBidMap.findIndex(s => s.bid === msg.fromBid)
        const toIdx = sectionBidMap.findIndex(s => s.bid === msg.toBid)
        if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
          saveCode(reorderSections(code, fromIdx, toIdx))
        }
        setDragOverIndex(null)
      }

      if (msg.type === 'builder:drag-over') {
        const idx = sectionBidMap.findIndex(s => s.bid === msg.overBid)
        setDragOverIndex(idx >= 0 ? idx : null)
      }
    }
    window.addEventListener('message', handleMsg)
    return () => window.removeEventListener('message', handleMsg)
  }, [visualEditMode, code, sectionBidMap, saveCode, sendToIframe, setSelectedElement])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showEditPanel) { setShowEditPanel(false); return }
        if (visualEditMode) {
          setSelectedElement(null)
          sendToIframe({ type: 'builder:clear' })
          return
        }
        if (fullscreen) setFullscreen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [fullscreen, showEditPanel, visualEditMode, setSelectedElement, sendToIframe])

  // ── Measure container height for Sandpack ─────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setContainerHeight(entry.contentRect.height)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const sandpackHeight = containerHeight > 0 ? `${containerHeight}px` : '100%'

  // ── Sandpack files (inject bridge when visual mode is on) ─────────────────
  const sandpackFiles = useMemo(() => ({
    '/App.js': code,
    ...(visualEditMode ? {
      '/builder-bridge.js': BUILDER_BRIDGE_JS,
      '/index.js': BUILDER_INDEX_JS,
    } : {}),
  }), [code, visualEditMode])

  // ── Edit panel handlers ───────────────────────────────────────────────────
  const applyTextEdit = useCallback((oldText: string, newText: string) => {
    saveCode(replaceText(code, oldText, newText))
  }, [code, saveCode])

  const applyLinkEdit = useCallback((oldAttr: string, newHref: string) => {
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
            {([
              { key: 'desktop', icon: '🖥', label: 'Desktop' },
              { key: 'tablet', icon: '📱', label: 'Tablet' },
              { key: 'mobile', icon: '📲', label: 'Mobile' },
            ] as const).map(({ key, icon, label }) => (
              <button key={key} onClick={() => setPreviewSize(key)} title={label}
                className={`px-1.5 py-0.5 text-xs rounded transition-colors ${previewSize === key ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}>
                {icon}
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          {activePreviewTab === 'preview' && (
            <>
              {/* Visual editor toggle */}
              <button
                onClick={() => {
                  setVisualEditMode(!visualEditMode)
                  if (visualEditMode) {
                    setSelectedElement(null)
                    sendToIframe({ type: 'builder:clear' })
                  }
                }}
                title="Visual editor — click elements to edit"
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                  visualEditMode ? 'bg-indigo-600 text-white' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                <span>⬡</span><span>Visual</span>
              </button>

              {/* Text/Link/Style editor toggle */}
              <button onClick={() => setShowEditPanel(o => !o)} title="Edit content & styles"
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${showEditPanel ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}>
                <span>✏️</span><span>Edit</span>
              </button>
            </>
          )}

          <button onClick={() => setPreviewTheme(previewTheme === 'dark' ? 'light' : 'dark')}
            title={`Switch to ${previewTheme === 'dark' ? 'light' : 'dark'} mode`}
            className="px-2 py-1 text-xs rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            {previewTheme === 'dark' ? '☀️' : '🌙'}
          </button>

          <button onClick={() => setFullscreen(!fullscreen)}
            title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
            className="px-2 py-1 text-xs rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            {fullscreen ? '⊠' : '⊞'}
          </button>
        </div>
      </div>

      {/* ── Preview / Code area ───────────────────────────────────────────── */}
      <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden flex justify-center relative">
        <div className="transition-all duration-300" style={{
          width: fullscreen ? '100%' : PREVIEW_WIDTHS[previewSize],
          maxWidth: '100%',
          height: sandpackHeight,
        }}>
          <SandpackProvider
            key={visualEditMode ? 'visual' : 'normal'}
            template="react"
            theme={previewTheme === 'light' ? 'light' : 'dark'}
            files={sandpackFiles}
            options={{ externalResources: ['https://cdn.tailwindcss.com'] }}
          >
            <SandpackLayout style={{ height: sandpackHeight, borderRadius: 0 }}>
              {activePreviewTab === 'preview'
                ? <SandpackPreview style={{ height: sandpackHeight }} showOpenInCodeSandbox={false} showNavigator={false} />
                : <SandpackCodeEditor style={{ height: sandpackHeight }} showLineNumbers />}
            </SandpackLayout>
          </SandpackProvider>
        </div>

        {/* ── Visual mode section overlay ───────────────────────────────── */}
        {visualEditMode && sectionBidMap.length > 0 && (
          <div className="absolute inset-0 z-10 pointer-events-none">
            {sectionBidMap.map((sec, i) => (
              <React.Fragment key={sec.bid ?? i}>
                {/* Delete section */}
                <button
                  style={{ position: 'absolute', top: sec.rect.top + 6, right: 8, pointerEvents: 'all' }}
                  onClick={() => { saveCode(deleteSection(code, i)); setSelectedElement(null) }}
                  className="w-5 h-5 bg-red-500/90 hover:bg-red-500 text-white rounded-full text-xs flex items-center justify-center shadow-lg transition-colors"
                  title="Delete section"
                >×</button>

                {/* Drag-over indicator */}
                {dragOverIndex === i && (
                  <div style={{ position: 'absolute', top: sec.rect.top - 2, left: sec.rect.left, width: sec.rect.width, height: 3, background: '#6366f1', borderRadius: 2, pointerEvents: 'none' }} />
                )}

                {/* Add section below */}
                <AddSectionButton
                  afterIndex={i}
                  top={sec.rect.top + sec.rect.height}
                  left={sec.rect.left + sec.rect.width / 2}
                  onAdd={(src) => saveCode(insertSectionAfter(code, i, src))}
                />
              </React.Fragment>
            ))}
          </div>
        )}

        {/* ── Text/Link/Style edit panel ────────────────────────────────── */}
        {showEditPanel && (
          <>
            <div className="absolute inset-0 z-10"
              onClick={() => { setShowEditPanel(false); setSelectedElement(null); sendToIframe({ type: 'builder:clear' }) }} />
            <div className="absolute top-2 right-2 z-20 w-80 max-h-[calc(100%-16px)] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <span className="text-sm font-semibold text-foreground">Edit Website</span>
                <button onClick={() => setShowEditPanel(false)} className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none">×</button>
              </div>
              <div className="flex border-b border-border shrink-0">
                {EDIT_TABS.map(t => (
                  <button key={t.key} onClick={() => setEditTab(t.key)}
                    className={`flex-1 py-2 text-xs font-medium transition-colors ${editTab === t.key ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="overflow-y-auto flex-1">
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
                {editTab === 'links' && (
                  <div className="p-3 space-y-3">
                    {linkEntries.length === 0
                      ? <p className="text-xs text-muted-foreground text-center py-8">No links found.</p>
                      : <>
                          <p className="text-xs text-muted-foreground">Set destinations. Use <code className="bg-secondary px-1 rounded">#section-id</code> for anchors.</p>
                          {linkEntries.map((entry, i) => (
                            <LinkRow key={`${entry.attrKey}-${i}`} entry={entry} onApply={applyLinkEdit} />
                          ))}
                        </>
                    }
                  </div>
                )}
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
