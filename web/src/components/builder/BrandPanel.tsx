'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { useBuilderStore } from '@/store/builderStore'

const COLORS = ['red','orange','amber','yellow','lime','green','emerald','teal','cyan','sky','blue','indigo','violet','purple','fuchsia','pink','rose','gray','zinc','slate'] as const
type BrandColor = typeof COLORS[number]

const COLOR_HEX: Record<BrandColor, string> = {
  red:'#ef4444', orange:'#f97316', amber:'#f59e0b', yellow:'#eab308',
  lime:'#84cc16', green:'#22c55e', emerald:'#10b981', teal:'#14b8a6',
  cyan:'#06b6d4', sky:'#0ea5e9', blue:'#3b82f6', indigo:'#6366f1',
  violet:'#8b5cf6', purple:'#a855f7', fuchsia:'#d946ef', pink:'#ec4899',
  rose:'#f43f5e', gray:'#6b7280', zinc:'#71717a', slate:'#64748b',
}

const FONTS = [
  'Inter', 'Poppins', 'Roboto', 'Montserrat', 'Lato',
  'Raleway', 'Playfair Display', 'Merriweather',
  'Space Grotesk', 'DM Sans', 'Nunito', 'Josefin Sans',
]

const RADIUS_OPTIONS = [
  { id: 'sharp', label: 'Sharp', preview: 'rounded-none' },
  { id: 'rounded', label: 'Rounded', preview: 'rounded-md' },
  { id: 'pill', label: 'Pill', preview: 'rounded-full' },
] as const

interface BrandSettings {
  primaryColor: BrandColor
  fontFamily: string
  borderRadius: 'sharp' | 'rounded' | 'pill'
  navCode?: string
}

function getDefaultBrand(settings: Record<string, unknown>): BrandSettings {
  const b = settings.brand as Partial<BrandSettings> | undefined
  return {
    primaryColor: (b?.primaryColor as BrandColor) ?? 'indigo',
    fontFamily: b?.fontFamily ?? 'Inter',
    borderRadius: b?.borderRadius ?? 'rounded',
    navCode: b?.navCode ?? '',
  }
}

export default function BrandPanel() {
  const { project, pages, projectSettings, setProjectSettings, setNavCode, navCode } = useBuilderStore()
  const [brand, setBrand] = useState<BrandSettings>(() => getDefaultBrand(projectSettings))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [generatingNav, setGeneratingNav] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync when project settings load
  useEffect(() => {
    setBrand(getDefaultBrand(projectSettings))
  }, [projectSettings])

  const save = useCallback(async (updated: BrandSettings) => {
    if (!project) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      const newSettings = { ...projectSettings, brand: updated }
      setProjectSettings(newSettings)
      await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: newSettings }),
      }).catch(() => {})
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }, 500)
  }, [project, projectSettings, setProjectSettings])

  function update(patch: Partial<BrandSettings>) {
    const updated = { ...brand, ...patch }
    setBrand(updated)
    save(updated)
  }

  function generateNav() {
    if (!project) return
    setGeneratingNav(true)
    const pageList = pages.map(p => p.name).join(', ')
    const prompt = `Create a beautiful sticky navigation bar for a website called "${project.name}".
Navigation links: ${pageList}.
Use ${brand.primaryColor} as the accent color for hover states and the logo.
Dark/zinc background. Logo text "${project.name}" on the left with the accent color. Links on the right with smooth hover transitions.
Export as: export default function App() { return <nav>...</nav> }
Do not add any other sections — ONLY the navigation bar component.`
    window.dispatchEvent(new CustomEvent('quick-edit', { detail: { prompt } }))
    // The nav code will be saved when the AI generates it
    // Listen for when previewCode updates and save it as navCode
    setGeneratingNav(false)
  }

  function clearNav() {
    setNavCode('')
    const updated = { ...brand, navCode: '' }
    setBrand(updated)
    save(updated)
  }

  return (
    <div className="space-y-5 text-xs">
      {/* Save status */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">Settings auto-save after changes</p>
        {saving && <span className="text-[10px] text-muted-foreground animate-pulse">↻ Saving…</span>}
        {saved && <span className="text-[10px] text-green-400">✓ Saved</span>}
      </div>

      {/* Primary Color */}
      <div>
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 block font-semibold">Primary Color</label>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(10, 1fr)' }}>
          {COLORS.map(c => (
            <button
              key={c}
              title={c}
              onClick={() => update({ primaryColor: c })}
              style={{ background: COLOR_HEX[c], width: 22, height: 22, borderRadius: 4 }}
              className={`transition-transform hover:scale-125 ${brand.primaryColor === c ? 'ring-2 ring-white ring-offset-1 ring-offset-background scale-110' : ''}`}
            />
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          Current: <span className="font-medium text-foreground">{brand.primaryColor}</span>
          {' '}<span style={{ color: COLOR_HEX[brand.primaryColor] }}>■</span>
        </p>
      </div>

      {/* Font Family */}
      <div>
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 block font-semibold">Font Family</label>
        <div className="grid grid-cols-2 gap-1">
          {FONTS.map(f => (
            <button
              key={f}
              onClick={() => update({ fontFamily: f })}
              className={`px-2 py-1.5 rounded border text-left transition-colors ${
                brand.fontFamily === f
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
              }`}
            >
              <span className="text-[11px]" style={{ fontFamily: f }}>{f}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Border Radius */}
      <div>
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 block font-semibold">Button Style</label>
        <div className="flex gap-2">
          {RADIUS_OPTIONS.map(r => (
            <button
              key={r.id}
              onClick={() => update({ borderRadius: r.id })}
              className={`flex-1 py-2 text-[10px] border transition-colors ${
                brand.borderRadius === r.id
                  ? 'border-primary bg-primary/10 text-foreground font-medium'
                  : 'border-border text-muted-foreground hover:text-foreground'
              } ${r.preview}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-secondary/50 border-b border-border">
          <p className="text-[10px] font-semibold text-foreground uppercase tracking-wide">Global Navigation</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">AI generates a shared nav shown on every page</p>
        </div>
        <div className="p-3 space-y-2">
          {navCode ? (
            <>
              <div className="flex items-center gap-2 p-2 bg-green-900/20 border border-green-800/40 rounded-lg">
                <span className="text-green-400 text-sm">✓</span>
                <span className="text-[10px] text-green-300 flex-1">Navigation is active</span>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={generateNav}
                  disabled={generatingNav}
                  className="flex-1 py-1.5 bg-secondary border border-border text-foreground rounded text-[10px] font-medium hover:bg-accent disabled:opacity-50 transition-colors"
                >
                  {generatingNav ? '↻ Regenerating…' : '↺ Regenerate Nav'}
                </button>
                <button
                  onClick={clearNav}
                  className="py-1.5 px-2.5 bg-red-900/30 border border-red-800/40 text-red-400 rounded text-[10px] hover:bg-red-900/50 transition-colors"
                  title="Remove navigation"
                >
                  ✕
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={generateNav}
              disabled={generatingNav || !project}
              className="w-full py-2 bg-primary text-primary-foreground rounded text-[10px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-1.5"
            >
              {generatingNav ? <><span className="animate-spin">↻</span> Generating…</> : '✦ Generate Navigation Bar'}
            </button>
          )}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/60 text-center">
        Brand settings are sent to AI with every request so colors, fonts, and style stay consistent across all pages.
      </p>
    </div>
  )
}
