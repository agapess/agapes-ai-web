'use client'
import { useState } from 'react'
import { useBuilderStore } from '@/store/builderStore'
import SeoPanel from './SeoPanel'

// ── Page template starters ─────────────────────────────────────────────────────
// Each template gives the page a pre-built JSX body the AI can then extend.
const PAGE_TEMPLATES: Array<{ name: string; icon: string; description: string; content: string }> = [
  {
    name: 'About',
    icon: '👤',
    description: 'Who you are and your story',
    content: `export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <section className="py-24 px-6 max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">About Us</h1>
        <p className="text-zinc-400 text-xl leading-relaxed mb-8">
          We are a passionate team dedicated to building exceptional experiences. Our story began with a simple idea: make the web more beautiful and accessible for everyone.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <div className="bg-zinc-900 rounded-2xl p-6 text-center">
            <div className="text-4xl font-bold text-indigo-400 mb-2">2019</div>
            <div className="text-zinc-400 text-sm">Founded</div>
          </div>
          <div className="bg-zinc-900 rounded-2xl p-6 text-center">
            <div className="text-4xl font-bold text-purple-400 mb-2">500+</div>
            <div className="text-zinc-400 text-sm">Happy Clients</div>
          </div>
          <div className="bg-zinc-900 rounded-2xl p-6 text-center">
            <div className="text-4xl font-bold text-pink-400 mb-2">12</div>
            <div className="text-zinc-400 text-sm">Team Members</div>
          </div>
        </div>
      </section>
      <section className="py-16 px-6 bg-zinc-900">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">Our Mission</h2>
          <p className="text-zinc-400 text-lg text-center max-w-2xl mx-auto leading-relaxed">
            To empower businesses and creators with tools that make the internet a better place — one website at a time.
          </p>
        </div>
      </section>
    </div>
  )
}`,
  },
  {
    name: 'Contact',
    icon: '✉️',
    description: 'Contact form and information',
    content: `export default function App() {
  const [sent, setSent] = React.useState(false)
  const [form, setForm] = React.useState({ name: '', email: '', message: '' })
  function handleSubmit(e) {
    e.preventDefault()
    setSent(true)
  }
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <section className="py-24 px-6 max-w-2xl mx-auto">
        <h1 className="text-5xl font-bold mb-4 text-center">Get In Touch</h1>
        <p className="text-zinc-400 text-center mb-12">We'd love to hear from you. Send us a message and we'll respond as soon as possible.</p>
        {sent ? (
          <div className="bg-green-900/30 border border-green-700 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-4">✅</div>
            <h2 className="text-2xl font-bold mb-2">Message Sent!</h2>
            <p className="text-zinc-400">We'll get back to you within 24 hours.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Your Name</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="John Doe" className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Email Address</label>
              <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} type="email" required placeholder="you@example.com" className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Message</label>
              <textarea value={form.message} onChange={e => setForm({...form, message: e.target.value})} required rows={5} placeholder="How can we help you?" className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none" />
            </div>
            <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-colors">Send Message →</button>
          </form>
        )}
        <div className="mt-12 grid grid-cols-3 gap-4 text-center">
          <div className="bg-zinc-900 rounded-xl p-4"><div className="text-2xl mb-2">📧</div><div className="text-xs text-zinc-400">hello@example.com</div></div>
          <div className="bg-zinc-900 rounded-xl p-4"><div className="text-2xl mb-2">📞</div><div className="text-xs text-zinc-400">+1 (555) 000-0000</div></div>
          <div className="bg-zinc-900 rounded-xl p-4"><div className="text-2xl mb-2">📍</div><div className="text-xs text-zinc-400">New York, NY</div></div>
        </div>
      </section>
    </div>
  )
}`,
  },
  {
    name: 'Services',
    icon: '⚡',
    description: 'What you offer',
    content: `export default function App() {
  const services = [
    { icon: '🎨', title: 'Design', desc: 'Beautiful, pixel-perfect UI/UX design that converts visitors into customers.', price: 'From $999' },
    { icon: '💻', title: 'Development', desc: 'Fast, scalable web applications built with modern technologies.', price: 'From $2,499' },
    { icon: '📈', title: 'Marketing', desc: 'SEO, content, and growth strategies that drive real results.', price: 'From $599/mo' },
    { icon: '🔒', title: 'Security', desc: 'Protect your business with enterprise-grade security solutions.', price: 'From $399/mo' },
    { icon: '☁️', title: 'Cloud & Hosting', desc: 'Reliable, high-performance hosting with 99.9% uptime guarantee.', price: 'From $49/mo' },
    { icon: '🤝', title: 'Consulting', desc: 'Strategic advice and roadmaps to accelerate your digital growth.', price: 'From $299/hr' },
  ]
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <section className="py-24 px-6 text-center">
        <h1 className="text-5xl font-bold mb-4">Our Services</h1>
        <p className="text-zinc-400 text-xl max-w-2xl mx-auto mb-16">Everything you need to build, grow, and scale your online presence.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {services.map(s => (
            <div key={s.title} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-left hover:border-indigo-500/50 transition-colors group">
              <div className="text-3xl mb-4">{s.icon}</div>
              <h3 className="text-xl font-bold mb-2 group-hover:text-indigo-400 transition-colors">{s.title}</h3>
              <p className="text-zinc-400 text-sm mb-4 leading-relaxed">{s.desc}</p>
              <div className="text-indigo-400 font-semibold text-sm">{s.price}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="py-16 px-6 bg-gradient-to-r from-indigo-900 to-purple-900 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
        <p className="text-indigo-200 mb-8">Let's discuss your project and find the perfect solution for your needs.</p>
        <button className="px-8 py-3 bg-white text-indigo-900 rounded-xl font-bold hover:bg-indigo-50 transition-colors">Book a Free Consultation</button>
      </section>
    </div>
  )
}`,
  },
  {
    name: 'Portfolio',
    icon: '🖼',
    description: 'Showcase your work',
    content: `export default function App() {
  const [filter, setFilter] = React.useState('All')
  const categories = ['All', 'Web', 'Mobile', 'Branding']
  const projects = [
    { title: 'E-Commerce Platform', category: 'Web', tags: ['React', 'Node.js'], color: 'from-blue-600 to-indigo-600' },
    { title: 'Finance App', category: 'Mobile', tags: ['React Native', 'Stripe'], color: 'from-purple-600 to-pink-600' },
    { title: 'Brand Identity', category: 'Branding', tags: ['Figma', 'Illustrator'], color: 'from-orange-600 to-red-600' },
    { title: 'SaaS Dashboard', category: 'Web', tags: ['Next.js', 'Tailwind'], color: 'from-teal-600 to-green-600' },
    { title: 'Health Tracker', category: 'Mobile', tags: ['Flutter', 'Firebase'], color: 'from-cyan-600 to-sky-600' },
    { title: 'Logo Collection', category: 'Branding', tags: ['Vectorwork', 'AI'], color: 'from-rose-600 to-pink-600' },
  ]
  const filtered = filter === 'All' ? projects : projects.filter(p => p.category === filter)
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-5xl font-bold mb-4 text-center">My Work</h1>
          <p className="text-zinc-400 text-center mb-10">A selection of projects I'm proud of.</p>
          <div className="flex justify-center gap-2 mb-10">
            {categories.map(c => (
              <button key={c} onClick={() => setFilter(c)} className={\`px-4 py-1.5 rounded-full text-sm font-medium transition-colors \${filter === c ? 'bg-indigo-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:text-white'}\`}>{c}</button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(p => (
              <div key={p.title} className="group cursor-pointer">
                <div className={\`rounded-2xl overflow-hidden aspect-video bg-gradient-to-br \${p.color} flex items-center justify-center mb-3 relative\`}>
                  <span className="text-white/30 text-4xl font-bold">{p.title[0]}</span>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white font-semibold text-sm bg-black/50 px-3 py-1.5 rounded-lg">View Project →</span>
                  </div>
                </div>
                <h3 className="font-semibold mb-1">{p.title}</h3>
                <div className="flex gap-1.5">{p.tags.map(t => <span key={t} className="text-xs bg-zinc-900 text-zinc-400 px-2 py-0.5 rounded">{t}</span>)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}`,
  },
  {
    name: 'Pricing',
    icon: '💳',
    description: 'Plans and pricing',
    content: `export default function App() {
  const [annual, setAnnual] = React.useState(false)
  const plans = [
    { name: 'Starter', price: annual ? 79 : 9, desc: 'Perfect for personal projects', features: ['5 projects', '10 GB storage', 'Basic analytics', 'Email support'], color: 'zinc', popular: false },
    { name: 'Pro', price: annual ? 199 : 29, desc: 'For growing businesses', features: ['Unlimited projects', '50 GB storage', 'Advanced analytics', 'Priority support', 'Custom domain', 'API access'], color: 'indigo', popular: true },
    { name: 'Enterprise', price: annual ? 499 : 79, desc: 'For large organizations', features: ['Everything in Pro', '500 GB storage', 'SSO & SAML', 'Dedicated support', 'SLA guarantee', 'Custom integrations'], color: 'purple', popular: false },
  ]
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <section className="py-24 px-6 text-center">
        <h1 className="text-5xl font-bold mb-4">Simple Pricing</h1>
        <p className="text-zinc-400 text-xl mb-8">No hidden fees. Cancel anytime.</p>
        <div className="flex items-center justify-center gap-3 mb-14">
          <span className={\`text-sm \${!annual ? 'text-white' : 'text-zinc-500'}\`}>Monthly</span>
          <button onClick={() => setAnnual(!annual)} className={\`w-12 h-6 rounded-full transition-colors relative \${annual ? 'bg-indigo-600' : 'bg-zinc-700'}\`}>
            <span className={\`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform \${annual ? 'translate-x-7' : 'translate-x-1'}\`} />
          </button>
          <span className={\`text-sm \${annual ? 'text-white' : 'text-zinc-500'}\`}>Annual <span className="text-green-400 font-semibold">Save 30%</span></span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map(p => (
            <div key={p.name} className={\`relative rounded-2xl p-6 text-left border \${p.popular ? 'border-indigo-500 bg-indigo-950/40' : 'border-zinc-800 bg-zinc-900'}\`}>
              {p.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-full">Most Popular</div>}
              <h3 className="text-xl font-bold mb-1">{p.name}</h3>
              <p className="text-zinc-400 text-sm mb-4">{p.desc}</p>
              <div className="mb-6"><span className="text-4xl font-bold">\${p.price}</span><span className="text-zinc-400 text-sm">/mo</span></div>
              <button className={\`w-full py-2.5 rounded-xl font-semibold mb-6 transition-colors \${p.popular ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-white'}\`}>Get Started</button>
              <ul className="space-y-2">{p.features.map(f => <li key={f} className="flex items-center gap-2 text-sm text-zinc-300"><span className="text-green-400">✓</span>{f}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}`,
  },
  {
    name: 'Blog',
    icon: '📝',
    description: 'Articles and posts',
    content: `export default function App() {
  const posts = [
    { title: 'Getting Started with Modern Web Development', category: 'Tutorial', date: 'May 20, 2025', read: '5 min', color: 'from-blue-600 to-indigo-600' },
    { title: 'The Future of AI in Design', category: 'Insights', date: 'May 15, 2025', read: '8 min', color: 'from-purple-600 to-pink-600' },
    { title: 'Building Scalable React Applications', category: 'Development', date: 'May 10, 2025', read: '12 min', color: 'from-teal-600 to-green-600' },
    { title: '10 Tips for Better User Experience', category: 'Design', date: 'May 5, 2025', read: '6 min', color: 'from-orange-600 to-red-600' },
    { title: 'Mastering Tailwind CSS in 2025', category: 'Tutorial', date: 'Apr 28, 2025', read: '7 min', color: 'from-cyan-600 to-sky-600' },
    { title: 'Why Performance Matters More Than Ever', category: 'Insights', date: 'Apr 20, 2025', read: '9 min', color: 'from-rose-600 to-pink-600' },
  ]
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-5xl font-bold mb-4 text-center">Blog</h1>
          <p className="text-zinc-400 text-center mb-14">Thoughts, tutorials, and insights from our team.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map(post => (
              <article key={post.title} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-600 transition-colors group cursor-pointer">
                <div className={\`h-40 bg-gradient-to-br \${post.color} flex items-end p-4\`}>
                  <span className="bg-black/30 text-white text-xs font-semibold px-2.5 py-1 rounded-full">{post.category}</span>
                </div>
                <div className="p-5">
                  <h2 className="font-bold text-lg mb-2 group-hover:text-indigo-400 transition-colors leading-snug">{post.title}</h2>
                  <div className="flex items-center gap-3 text-xs text-zinc-500 mt-4">
                    <span>{post.date}</span>
                    <span>·</span>
                    <span>{post.read} read</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}`,
  },
  {
    name: 'Gallery',
    icon: '🖼',
    description: 'Photo gallery with upload slots',
    content: `export default function App() {
  const placeholders = Array.from({length: 9}, (_, i) => i)
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-5xl font-bold mb-4 text-center">Gallery</h1>
          <p className="text-zinc-400 text-center mb-14">A collection of our finest work and moments.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {placeholders.map(i => (
              <div key={i} className="aspect-square bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-indigo-500/50 transition-colors group">
                <div className="text-4xl opacity-30">🖼</div>
                <span className="text-xs text-zinc-600 group-hover:text-zinc-400 transition-colors">Upload image {i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}`,
  },
]

export default function PageManager() {
  const { pages, activePage, setActivePage, project, setPages } = useBuilderStore()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)
  const [seoPageId, setSeoPageId] = useState<string | null>(null)

  async function createPage(name?: string, content?: string) {
    const pageName = name ?? newName.trim()
    if (!pageName || !project) return
    setCreating(true)
    const res = await fetch(`/api/pages/${project.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: pageName }),
    })
    const data = await res.json()
    setCreating(false)
    if (data.page) {
      const newPage = { ...data.page, content: content ?? '' }
      setNewName('')
      setShowTemplates(false)
      // If template content provided, persist it immediately
      if (content && project) {
        fetch(`/api/pages/${project.id}/${data.page.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        }).catch(() => {})
      }
      setPages([...pages, newPage])
      setActivePage(newPage)
    }
  }

  async function deletePage(pageId: string) {
    if (!project) return
    if (!confirm('Delete this page?')) return
    await fetch(`/api/pages/${project.id}/${pageId}`, { method: 'DELETE' })
    const remaining = pages.filter(p => p.id !== pageId)
    setPages(remaining)
    if (activePage?.id === pageId) {
      const home = remaining.find(p => p.isHomePage) ?? remaining[0]
      if (home) setActivePage(home)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {/* Page list */}
      {pages.map(page => (
        <div key={page.id}>
          <div
            className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer group ${
              activePage?.id === page.id ? 'bg-primary/20 text-primary' : 'hover:bg-secondary text-foreground'
            }`}
            onClick={() => setActivePage(page)}
          >
            <span className="text-xs truncate flex-1">{page.name}</span>
            {/* SEO button */}
            <button
              onClick={e => { e.stopPropagation(); setSeoPageId(seoPageId === page.id ? null : page.id) }}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground text-[10px] transition-opacity ml-1 px-1"
              title="SEO settings"
            >
              SEO
            </button>
            {!page.isHomePage ? (
              <button
                onClick={e => { e.stopPropagation(); deletePage(page.id) }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 text-xs transition-opacity"
              >
                ✕
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">home</span>
            )}
          </div>
          {/* Inline SEO panel */}
          {seoPageId === page.id && project && (
            <SeoPanel
              pageId={page.id}
              projectId={project.id}
              initialTitle={page.seoTitle ?? ''}
              initialDesc={page.seoDescription ?? ''}
              onClose={() => setSeoPageId(null)}
            />
          )}
        </div>
      ))}

      {/* Custom name input */}
      <div className="mt-2 flex gap-1">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && createPage()}
          placeholder="New page name…"
          className="flex-1 px-2 py-1 bg-secondary border border-border rounded text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={() => createPage()}
          disabled={creating || !newName.trim()}
          className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs disabled:opacity-50"
          title="Create blank page"
        >
          +
        </button>
      </div>

      {/* Template picker toggle */}
      <button
        onClick={() => setShowTemplates(o => !o)}
        className="mt-1 flex items-center gap-1.5 px-2 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      >
        <span className="text-[10px]">{showTemplates ? '▲' : '▼'}</span>
        Add from template
      </button>

      {/* Template grid */}
      {showTemplates && (
        <div className="mt-1 border border-border rounded-lg overflow-hidden">
          <div className="px-2 py-1.5 bg-secondary/50 border-b border-border">
            <p className="text-[10px] text-muted-foreground">Choose a starter layout — AI can customize it further</p>
          </div>
          <div className="divide-y divide-border">
            {PAGE_TEMPLATES.map(tpl => (
              <button
                key={tpl.name}
                disabled={creating}
                onClick={() => createPage(tpl.name, tpl.content)}
                className="w-full text-left px-3 py-2 hover:bg-secondary transition-colors group flex items-center gap-2.5 disabled:opacity-50"
              >
                <span className="text-base shrink-0">{tpl.icon}</span>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">{tpl.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{tpl.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
