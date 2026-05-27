'use client'
import { useBuilderStore } from '@/store/builderStore'

interface Component {
  name: string
  icon: string
  description: string
  code: string
}

const COMPONENTS: Component[] = [
  {
    name: 'Hero',
    icon: '🦸',
    description: 'Full-screen hero with gradient',
    code: `export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center px-6">
      <div className="text-center max-w-4xl">
        <h1 className="text-6xl md:text-7xl font-bold text-white mb-6 leading-tight">
          Build Something <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-yellow-400">Amazing</span>
        </h1>
        <p className="text-xl text-purple-200 mb-10 max-w-2xl mx-auto">The fastest way to launch your idea. No code required. Powered by AI.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className="px-8 py-4 bg-white text-indigo-900 rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-xl">Get Started Free</button>
          <button className="px-8 py-4 border-2 border-white text-white rounded-full font-bold text-lg hover:bg-white/10 transition-colors">Watch Demo</button>
        </div>
      </div>
    </div>
  )
}`,
  },
  {
    name: 'Navbar',
    icon: '🔲',
    description: 'Responsive navigation bar',
    code: `import { useState } from 'react'
export default function App() {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-screen bg-gray-950">
      <nav className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="text-white font-bold text-xl">BrandName</span>
          <div className="hidden md:flex items-center gap-8">
            {['Home','Features','Pricing','About'].map(item => (
              <a key={item} href="#" className="text-gray-400 hover:text-white transition-colors text-sm">{item}</a>
            ))}
          </div>
          <button className="hidden md:block px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">Get Started</button>
          <button className="md:hidden text-gray-400" onClick={() => setOpen(!open)}>{open ? '✕' : '☰'}</button>
        </div>
        {open && (
          <div className="md:hidden mt-4 pb-2 flex flex-col gap-3">
            {['Home','Features','Pricing','About'].map(item => (
              <a key={item} href="#" className="text-gray-400 hover:text-white text-sm">{item}</a>
            ))}
          </div>
        )}
      </nav>
      <div className="p-8 text-gray-500 text-center">Page content here…</div>
    </div>
  )
}`,
  },
  {
    name: 'Pricing',
    icon: '💰',
    description: '3-tier pricing cards',
    code: `export default function App() {
  const plans = [
    { name: 'Starter', price: '$9', features: ['5 projects', '10GB storage', 'Basic support'], highlight: false },
    { name: 'Pro', price: '$29', features: ['Unlimited projects', '100GB storage', 'Priority support', 'Analytics'], highlight: true },
    { name: 'Enterprise', price: '$99', features: ['Everything in Pro', 'Unlimited storage', 'Dedicated support', 'SLA'], highlight: false },
  ]
  return (
    <div className="min-h-screen bg-gray-950 py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-4xl font-bold text-white text-center mb-4">Simple Pricing</h2>
        <p className="text-gray-400 text-center mb-16">No hidden fees. Cancel anytime.</p>
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map(plan => (
            <div key={plan.name} className={\`rounded-2xl p-8 \${plan.highlight ? 'bg-indigo-600 ring-2 ring-indigo-400' : 'bg-gray-900'}\`}>
              <h3 className="text-white font-bold text-xl mb-6">{plan.name}</h3>
              <div className="text-4xl font-bold text-white mb-8">{plan.price}<span className="text-lg font-normal text-gray-400">/mo</span></div>
              <ul className="space-y-3 mb-8">{plan.features.map(f => <li key={f} className="text-sm text-gray-300 flex items-center gap-2"><span>✓</span>{f}</li>)}</ul>
              <button className={\`w-full py-3 rounded-xl font-semibold \${plan.highlight ? 'bg-white text-indigo-600' : 'bg-indigo-600 text-white'}\`}>Get Started</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}`,
  },
  {
    name: 'Features',
    icon: '✨',
    description: 'Feature grid with icons',
    code: `export default function App() {
  const features = [
    { icon: '⚡', title: 'Lightning Fast', desc: 'Optimized for performance.' },
    { icon: '🔒', title: 'Secure', desc: 'Enterprise-grade security.' },
    { icon: '📱', title: 'Mobile First', desc: 'Responsive on any device.' },
    { icon: '🤖', title: 'AI Powered', desc: 'Smart automation built-in.' },
    { icon: '🌍', title: 'Global CDN', desc: '99.9% uptime guarantee.' },
    { icon: '📊', title: 'Analytics', desc: 'Deep user insights.' },
  ]
  return (
    <div className="min-h-screen bg-gray-950 py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-4xl font-bold text-white text-center mb-4">Everything You Need</h2>
        <p className="text-gray-400 text-center mb-16 max-w-2xl mx-auto">Built for teams who want to move fast.</p>
        <div className="grid md:grid-cols-3 gap-6">
          {features.map(f => (
            <div key={f.title} className="bg-gray-900 rounded-2xl p-6 border border-gray-800 hover:border-indigo-500 transition-colors">
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="text-white font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}`,
  },
  {
    name: 'CTA',
    icon: '📣',
    description: 'Call-to-action section',
    code: `export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6">
      <div className="max-w-3xl mx-auto text-center bg-gradient-to-r from-indigo-900 to-purple-900 rounded-3xl p-16 border border-indigo-500/30">
        <h2 className="text-5xl font-bold text-white mb-6">Ready to Get Started?</h2>
        <p className="text-indigo-200 text-xl mb-10">Join 10,000+ teams already building with us.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className="px-10 py-4 bg-white text-indigo-900 rounded-full font-bold text-lg hover:scale-105 transition-transform">Start Free Trial</button>
          <button className="px-10 py-4 border-2 border-white/50 text-white rounded-full font-semibold text-lg hover:border-white transition-colors">Talk to Sales</button>
        </div>
        <p className="text-indigo-300 text-sm mt-6">No credit card required · Cancel anytime</p>
      </div>
    </div>
  )
}`,
  },
  {
    name: 'Footer',
    icon: '📋',
    description: 'Multi-column footer',
    code: `export default function App() {
  const cols = [
    { title: 'Product', links: ['Features', 'Pricing', 'Changelog', 'Roadmap'] },
    { title: 'Company', links: ['About', 'Blog', 'Careers', 'Press'] },
    { title: 'Resources', links: ['Docs', 'API', 'Guides', 'Community'] },
    { title: 'Legal', links: ['Privacy', 'Terms', 'Cookies', 'Licenses'] },
  ]
  return (
    <div className="bg-gray-950 min-h-screen flex flex-col">
      <div className="flex-1 bg-gray-900/20 p-8 text-gray-600 text-center">Main content area</div>
      <footer className="bg-gray-900 border-t border-gray-800 px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="text-white font-bold text-xl mb-3">Brand</div>
              <p className="text-gray-400 text-sm">Building the future of the web.</p>
            </div>
            {cols.map(col => (
              <div key={col.title}>
                <h4 className="text-white font-semibold text-sm mb-4">{col.title}</h4>
                <ul className="space-y-3">{col.links.map(link => <li key={link}><a href="#" className="text-gray-400 hover:text-white text-sm">{link}</a></li>)}</ul>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-800 pt-8 flex items-center justify-between">
            <p className="text-gray-500 text-sm">© 2025 Brand Inc.</p>
            <div className="flex gap-6">{['Twitter','GitHub','Discord'].map(s => <a key={s} href="#" className="text-gray-400 hover:text-white text-sm">{s}</a>)}</div>
          </div>
        </div>
      </footer>
    </div>
  )
}`,
  },
  {
    name: 'Dashboard',
    icon: '📊',
    description: 'Admin dashboard layout',
    code: `import { useState } from 'react'
export default function App() {
  const stats = [
    { label: 'Total Users', value: '12,430', change: '+12%', up: true },
    { label: 'Revenue', value: '$48,200', change: '+8%', up: true },
    { label: 'Projects', value: '3,240', change: '-2%', up: false },
    { label: 'Conversion', value: '3.6%', change: '+0.4%', up: true },
  ]
  return (
    <div className="min-h-screen bg-gray-950 flex">
      <aside className="w-56 bg-gray-900 border-r border-gray-800 p-4 hidden md:flex flex-col gap-1">
        <div className="text-white font-bold text-lg mb-6 px-2">Dashboard</div>
        {['Overview','Analytics','Users','Revenue','Settings'].map(item => (
          <button key={item} className="text-left px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg text-sm">{item}</button>
        ))}
      </aside>
      <main className="flex-1 p-8">
        <h1 className="text-white text-2xl font-bold mb-8">Overview</h1>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map(s => (
            <div key={s.label} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <p className="text-gray-400 text-xs mb-1">{s.label}</p>
              <p className="text-white text-2xl font-bold">{s.value}</p>
              <p className={\`text-xs mt-1 \${s.up ? 'text-green-400' : 'text-red-400'}\`}>{s.change}</p>
            </div>
          ))}
        </div>
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-white font-semibold mb-4">Recent Activity</h2>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-800 last:border-0">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs text-white">U{i}</div>
              <div><p className="text-gray-300 text-sm">User {i} completed an action</p><p className="text-gray-500 text-xs">{i}h ago</p></div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}`,
  },
  {
    name: 'Contact',
    icon: '✉️',
    description: 'Contact form',
    code: `import { useState } from 'react'
export default function App() {
  const [sent, setSent] = useState(false)
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6 py-20">
      <div className="max-w-xl w-full">
        <h2 className="text-4xl font-bold text-white mb-2">Get in Touch</h2>
        <p className="text-gray-400 mb-10">We'd love to hear from you.</p>
        {sent ? (
          <div className="bg-green-900/30 border border-green-700 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-4">✅</div>
            <h3 className="text-white font-bold text-xl mb-2">Message Sent!</h3>
            <p className="text-green-300">We'll get back to you within 24 hours.</p>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={e => { e.preventDefault(); setSent(true) }}>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-gray-400 text-sm mb-1.5">First Name</label>
                <input className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-indigo-500" placeholder="John" />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1.5">Last Name</label>
                <input className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-indigo-500" placeholder="Doe" />
              </div>
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1.5">Email</label>
              <input type="email" className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-indigo-500" placeholder="john@example.com" />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1.5">Message</label>
              <textarea rows={5} className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 resize-none" placeholder="Your message…" />
            </div>
            <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700">Send Message</button>
          </form>
        )}
      </div>
    </div>
  )
}`,
  },
]

export default function ComponentLibrary() {
  const { project, activePage, setPreviewCode, updatePageContent } = useBuilderStore()

  function insertComponent(component: Component) {
    setPreviewCode(component.code)
    if (activePage && project) {
      updatePageContent(activePage.id, component.code)
      fetch(`/api/pages/${project.id}/${activePage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: component.code }),
      }).catch(() => {})
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {COMPONENTS.map(comp => (
        <button
          key={comp.name}
          onClick={() => insertComponent(comp)}
          className="flex items-center gap-2.5 px-2 py-2 rounded hover:bg-secondary text-left group transition-colors"
        >
          <span className="text-base">{comp.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-foreground">{comp.name}</div>
            <div className="text-xs text-muted-foreground truncate">{comp.description}</div>
          </div>
          <span className="opacity-0 group-hover:opacity-100 text-xs text-primary transition-opacity shrink-0">Insert</span>
        </button>
      ))}
    </div>
  )
}
