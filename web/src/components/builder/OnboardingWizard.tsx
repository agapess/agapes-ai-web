'use client'
import { useState } from 'react'
import { useBuilderStore } from '@/store/builderStore'

const SITE_TYPES = [
  { id: 'business', icon: '🏢', label: 'Business', desc: 'Company or agency' },
  { id: 'portfolio', icon: '🎨', label: 'Portfolio', desc: 'Showcase your work' },
  { id: 'ecommerce', icon: '🛍', label: 'E-commerce', desc: 'Online store' },
  { id: 'restaurant', icon: '🍽', label: 'Restaurant', desc: 'Food & dining' },
  { id: 'blog', icon: '✍️', label: 'Blog', desc: 'Articles & posts' },
  { id: 'landing', icon: '🚀', label: 'Landing Page', desc: 'Product or campaign' },
]

const VISUAL_STYLES = [
  { id: 'dark', label: 'Dark & Bold', desc: 'Deep backgrounds, bright accents', bg: 'from-zinc-900 to-zinc-800', accent: 'text-indigo-400' },
  { id: 'light', label: 'Light & Clean', desc: 'White backgrounds, elegant typography', bg: 'from-gray-50 to-white', accent: 'text-blue-600' },
  { id: 'colorful', label: 'Colorful & Vibrant', desc: 'Bold gradients, energetic feel', bg: 'from-purple-600 to-pink-500', accent: 'text-white' },
  { id: 'minimal', label: 'Minimal', desc: 'Clean lines, maximum whitespace', bg: 'from-stone-100 to-stone-50', accent: 'text-stone-700' },
]

const FONT_FEELS = [
  { id: 'modern', label: 'Modern Sans', font: 'Inter', desc: 'Clean, professional, versatile' },
  { id: 'classic', label: 'Classic Serif', font: 'Playfair Display', desc: 'Elegant, editorial, timeless' },
  { id: 'techy', label: 'Techy Mono', font: 'Space Grotesk', desc: 'Tech-forward, precise, bold' },
  { id: 'friendly', label: 'Rounded & Friendly', font: 'Nunito', desc: 'Approachable, warm, inviting' },
]

const STYLE_BRAND_COLORS: Record<string, string> = {
  dark: 'indigo', light: 'blue', colorful: 'purple', minimal: 'stone',
}
const STYLE_FONT: Record<string, string> = {
  modern: 'Inter', classic: 'Playfair Display', techy: 'Space Grotesk', friendly: 'Nunito',
}

interface Props {
  onComplete: () => void
}

export default function OnboardingWizard({ onComplete }: Props) {
  const { project, pages, projectSettings, setProjectSettings } = useBuilderStore()

  const [step, setStep] = useState(0)
  const [siteType, setSiteType] = useState('')
  const [siteName, setSiteName] = useState(project?.name ?? '')
  const [tagline, setTagline] = useState('')
  const [description, setDescription] = useState('')
  const [visualStyle, setVisualStyle] = useState('')
  const [fontFeel, setFontFeel] = useState('')
  const [generating, setGenerating] = useState(false)

  const steps = ['Site Type', 'Brand Info', 'Visual Style', 'Font Feel']
  const canNext = [
    !!siteType,
    !!siteName.trim(),
    !!visualStyle,
    !!fontFeel,
  ]

  async function generate() {
    if (!project) return
    setGenerating(true)

    const styleDesc: Record<string, string> = {
      dark: 'dark backgrounds (zinc-900/950), bright white text, and indigo/purple accents',
      light: 'white/light gray backgrounds, dark text, subtle blue accents, and plenty of whitespace',
      colorful: 'bold gradient backgrounds (purple to pink), vibrant colors, and high energy',
      minimal: 'pure white background, stone/neutral palette, clean lines, and generous whitespace',
    }
    const fontDesc: Record<string, string> = {
      modern: 'clean modern sans-serif typography (Inter-style)',
      classic: 'elegant serif typography (Playfair Display-style) for headings',
      techy: 'sharp geometric sans (Space Grotesk-style) with technical feel',
      friendly: 'rounded friendly sans (Nunito-style) for a warm approachable feel',
    }
    const pageList = pages.map(p => p.name).join(', ')
    const prompt = `Build a complete, visually stunning ${siteType} website for "${siteName}"${tagline ? ` — "${tagline}"` : ''}.${description ? ` ${description}.` : ''}

Style: ${styleDesc[visualStyle] ?? visualStyle}.
Typography: ${fontDesc[fontFeel] ?? fontFeel}.
Pages in this site: ${pageList}.

Include ALL of these sections in one beautiful page:
1. Sticky navigation bar with logo and page links (${pageList})
2. Hero section with headline, subheadline, and CTA button
3. Features or services section (3-6 items with icons)
4. About section with story or mission statement
5. Testimonials or social proof section
6. Contact section with form
7. Footer with links and copyright

Make it world-class quality — the kind of site that wins awards. Use advanced Tailwind CSS with gradients, shadows, hover animations, and transitions. Fully responsive with mobile breakpoints.`

    // Save brand settings to project
    const brandColor = STYLE_BRAND_COLORS[visualStyle] ?? 'indigo'
    const fontFamily = STYLE_FONT[fontFeel] ?? 'Inter'
    const newSettings = { ...projectSettings, brand: { primaryColor: brandColor, fontFamily, borderRadius: 'rounded' }, onboardingComplete: true }
    setProjectSettings(newSettings)

    await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: newSettings }),
    }).catch(() => {})

    // Dispatch the generation prompt
    window.dispatchEvent(new CustomEvent('quick-edit', { detail: { prompt } }))
    onComplete()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-foreground">✦ Build your website</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Answer 4 quick questions and AI builds the whole site for you</p>
            </div>
            <button onClick={onComplete} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
          </div>
          {/* Progress bar */}
          <div className="flex gap-1.5">
            {steps.map((s, i) => (
              <div key={s} className="flex-1 flex flex-col gap-1">
                <div className={`h-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-secondary'}`} />
                <span className={`text-[10px] text-center ${i === step ? 'text-foreground' : 'text-muted-foreground/60'}`}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="px-6 py-5 min-h-[280px]">
          {step === 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-4">What kind of website are you building?</p>
              <div className="grid grid-cols-3 gap-2">
                {SITE_TYPES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSiteType(t.id)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                      siteType === t.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/40 hover:bg-secondary/50'
                    }`}
                  >
                    <span className="text-2xl">{t.icon}</span>
                    <span className="text-xs font-medium text-foreground">{t.label}</span>
                    <span className="text-[10px] text-muted-foreground text-center">{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Tell us about your brand</p>
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Site name *</label>
                <input
                  value={siteName}
                  onChange={e => setSiteName(e.target.value)}
                  placeholder="e.g. Acme Corp, John's Portfolio…"
                  className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Tagline <span className="text-muted-foreground font-normal">(optional)</span></label>
                <input
                  value={tagline}
                  onChange={e => setTagline(e.target.value)}
                  placeholder="e.g. Build faster, ship smarter"
                  className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Brief description <span className="text-muted-foreground font-normal">(optional)</span></label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  placeholder="1-2 sentences about what you do or offer…"
                  className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary transition-colors resize-none"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="text-sm text-muted-foreground mb-4">Choose your visual style</p>
              <div className="grid grid-cols-2 gap-2.5">
                {VISUAL_STYLES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setVisualStyle(s.id)}
                    className={`flex flex-col overflow-hidden rounded-xl border-2 transition-all ${
                      visualStyle === s.id ? 'border-primary' : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <div className={`h-16 bg-gradient-to-br ${s.bg} flex items-center justify-center`}>
                      <span className={`text-sm font-bold ${s.accent}`}>Aa</span>
                    </div>
                    <div className="p-2.5 text-left bg-card">
                      <p className="text-xs font-semibold text-foreground">{s.label}</p>
                      <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <p className="text-sm text-muted-foreground mb-4">Choose your typography style</p>
              <div className="space-y-2">
                {FONT_FEELS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFontFeel(f.id)}
                    className={`w-full flex items-center gap-4 p-3 rounded-xl border-2 transition-all ${
                      fontFeel === f.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40 hover:bg-secondary/50'
                    }`}
                  >
                    <span className="text-xl font-bold text-foreground w-12 shrink-0" style={{ fontFamily: f.font }}>Aa</span>
                    <div className="text-left">
                      <p className="text-xs font-semibold text-foreground">{f.label}</p>
                      <p className="text-[10px] text-muted-foreground">{f.desc}</p>
                    </div>
                    {fontFeel === f.id && <span className="ml-auto text-primary text-sm">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <button
            onClick={() => step > 0 ? setStep(s => s - 1) : onComplete()}
            className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {step === 0 ? 'Skip wizard' : '← Back'}
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext[step]}
              className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={generate}
              disabled={!canNext[3] || generating}
              className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center gap-2"
            >
              {generating ? (
                <><span className="animate-spin">↻</span> Generating…</>
              ) : (
                '✦ Generate My Website →'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
