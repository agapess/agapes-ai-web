import { eq } from 'drizzle-orm'
import { db } from './db'
import { aiProviderConfigs, templates, users } from './schema'
import { generateId } from './utils'

export function seedDefaultProviders(): void {
  const existing = db.select().from(aiProviderConfigs)
    .where(eq(aiProviderConfigs.scope, 'platform'))
    .get()

  if (existing) return

  const ollamaUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
  const defaultModel = process.env.DEFAULT_MODEL ?? 'llama3.2'

  db.insert(aiProviderConfigs).values({
    id: generateId(),
    scope: 'platform',
    provider: 'ollama',
    displayName: 'Ollama (Local)',
    baseUrl: ollamaUrl,
    model: defaultModel,
    isDefault: true,
    isActive: true,
    allowedPlans: JSON.stringify(['free', 'pro', 'enterprise']),
    creditCostPerRequest: 0,
  }).run()
}

// ---------------------------------------------------------------------------
// Starter templates seeded on first admin login
// ---------------------------------------------------------------------------

const SEED_TEMPLATES = [
  {
    name: 'Landing Page',
    description: 'Hero section with gradient background, features grid, and call-to-action',
    category: 'landing' as const,
    code: `export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="px-6 py-4 flex items-center justify-between border-b border-gray-800">
        <span className="font-bold text-xl">Brand</span>
        <div className="flex gap-6 text-sm text-gray-400">
          {['Features','Pricing','Docs'].map(item => (
            <a key={item} href="#" className="hover:text-white transition-colors">{item}</a>
          ))}
        </div>
        <button className="px-4 py-2 bg-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-700">Get Started</button>
      </nav>
      <section className="text-center py-28 px-6 bg-gradient-to-b from-indigo-950 to-gray-950">
        <div className="inline-block bg-indigo-500/20 text-indigo-300 text-xs font-semibold px-3 py-1 rounded-full mb-6">Now in Beta</div>
        <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Build faster with AI</h1>
        <p className="text-gray-400 text-xl max-w-2xl mx-auto mb-10">The all-in-one platform to design, build, and launch your product in record time.</p>
        <div className="flex gap-4 justify-center">
          <button className="px-8 py-4 bg-indigo-600 rounded-xl font-semibold text-lg hover:bg-indigo-700 transition-colors">Start for free</button>
          <button className="px-8 py-4 border border-gray-700 rounded-xl font-semibold text-lg hover:border-gray-500 transition-colors">Watch demo →</button>
        </div>
      </section>
      <section className="py-24 px-6 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-16">Everything you need</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: '⚡', title: 'Lightning Fast', desc: 'Ship features in minutes, not weeks.' },
            { icon: '🔒', title: 'Secure by Default', desc: 'Enterprise-grade security out of the box.' },
            { icon: '📊', title: 'Built-in Analytics', desc: 'Understand your users from day one.' },
          ].map(f => (
            <div key={f.title} className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="font-semibold text-xl mb-2">{f.title}</h3>
              <p className="text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="py-24 px-6 text-center bg-gradient-to-t from-indigo-950 to-gray-950">
        <h2 className="text-4xl font-bold mb-4">Ready to launch?</h2>
        <p className="text-gray-400 mb-8">Join 10,000+ teams building with us.</p>
        <button className="px-10 py-4 bg-white text-gray-950 rounded-xl font-bold text-lg hover:opacity-90 transition-opacity">Get started free</button>
      </section>
    </div>
  )
}`,
  },
  {
    name: 'SaaS App',
    description: 'Navigation, hero with social proof, and a 3-tier pricing section',
    category: 'saas' as const,
    code: `export default function App() {
  const plans = [
    { name: 'Starter', price: '$9', features: ['5 projects', '10GB storage', 'Email support'], highlight: false },
    { name: 'Pro', price: '$29', features: ['Unlimited projects', '100GB storage', 'Priority support', 'Analytics'], highlight: true },
    { name: 'Enterprise', price: '$99', features: ['Everything in Pro', 'SSO', 'SLA', 'Dedicated manager'], highlight: false },
  ]
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="px-8 py-5 flex items-center justify-between max-w-7xl mx-auto">
        <span className="font-black text-2xl tracking-tight">Acme<span className="text-indigo-400">.</span></span>
        <div className="hidden md:flex gap-8 text-sm text-gray-400">
          {['Product','Pricing','Blog','Careers'].map(i => <a key={i} href="#" className="hover:text-white">{i}</a>)}
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 text-sm text-gray-300 hover:text-white">Sign in</button>
          <button className="px-4 py-2 bg-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-700">Start free trial</button>
        </div>
      </nav>
      <section className="text-center pt-20 pb-16 px-6">
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1,2,3,4,5].map(s => <span key={s} className="text-yellow-400 text-lg">★</span>)}
          <span className="text-gray-400 text-sm ml-1">Loved by 3,000+ teams</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">The SaaS platform<br/><span className="text-indigo-400">that grows with you</span></h1>
        <p className="text-gray-400 text-xl max-w-2xl mx-auto mb-10">Automate your workflow, delight your customers, and scale without limits.</p>
        <button className="px-10 py-4 bg-indigo-600 rounded-2xl font-bold text-lg hover:bg-indigo-700">Start free — no credit card</button>
      </section>
      <section className="py-20 px-6 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4">Simple pricing</h2>
        <p className="text-gray-400 text-center mb-12">Cancel anytime. No hidden fees.</p>
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map(plan => (
            <div key={plan.name} className={\`rounded-2xl p-8 border \${plan.highlight ? 'bg-indigo-600 border-indigo-400 scale-105' : 'bg-gray-900 border-gray-800'}\`}>
              <h3 className="font-bold text-xl mb-1">{plan.name}</h3>
              <div className="text-4xl font-black mb-6">{plan.price}<span className="text-base font-normal opacity-60">/mo</span></div>
              <ul className="space-y-3 mb-8">{plan.features.map(f => <li key={f} className="flex items-center gap-2 text-sm"><span className="text-green-400">✓</span>{f}</li>)}</ul>
              <button className={\`w-full py-3 rounded-xl font-semibold \${plan.highlight ? 'bg-white text-indigo-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}\`}>Get started</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}`,
  },
  {
    name: 'Portfolio',
    description: 'Personal portfolio with bio, skills, and project showcase grid',
    category: 'portfolio' as const,
    code: `export default function App() {
  const projects = [
    { title: 'E-commerce Platform', tag: 'React · Node', desc: 'Full-stack marketplace with payments and real-time inventory.' },
    { title: 'AI Dashboard', tag: 'Next.js · OpenAI', desc: 'Analytics platform powered by GPT for automated insights.' },
    { title: 'Mobile Banking App', tag: 'React Native', desc: 'Fintech app with biometric auth and instant transfers.' },
    { title: 'Design System', tag: 'Figma · Storybook', desc: 'Component library used by 50+ products across the org.' },
  ]
  const skills = ['React','Next.js','TypeScript','Node.js','PostgreSQL','AWS','Figma','Python']
  return (
    <div className="min-h-screen bg-gray-950 text-white px-6 py-16">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-6 mb-12">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center text-3xl font-black">A</div>
          <div>
            <h1 className="text-3xl font-bold">Alex Chen</h1>
            <p className="text-indigo-400 font-medium">Full-Stack Engineer & Designer</p>
            <p className="text-gray-400 text-sm mt-1">San Francisco, CA · Open to work</p>
          </div>
        </div>
        <p className="text-gray-300 text-lg leading-relaxed mb-10">
          I build products people love. 5+ years turning complex problems into clean, scalable software.
          Previously at Stripe, Vercel, and two startups I co-founded.
        </p>
        <div className="mb-12">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Skills</h2>
          <div className="flex flex-wrap gap-2">
            {skills.map(s => <span key={s} className="bg-gray-800 border border-gray-700 px-3 py-1 rounded-full text-sm text-gray-300">{s}</span>)}
          </div>
        </div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-6">Selected Work</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {projects.map(p => (
            <div key={p.title} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-indigo-500 transition-colors cursor-pointer">
              <div className="text-xs text-indigo-400 font-mono mb-2">{p.tag}</div>
              <h3 className="font-semibold text-lg mb-2">{p.title}</h3>
              <p className="text-gray-400 text-sm">{p.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-8 border-t border-gray-800 flex gap-6 text-sm text-gray-400">
          {['GitHub','LinkedIn','Twitter','Email'].map(l => <a key={l} href="#" className="hover:text-white transition-colors">{l}</a>)}
        </div>
      </div>
    </div>
  )
}`,
  },
  {
    name: 'E-commerce Store',
    description: 'Product grid with hero banner, category filters, and add-to-cart buttons',
    category: 'ecommerce' as const,
    code: `import { useState } from 'react'
export default function App() {
  const [cart, setCart] = useState(0)
  const [category, setCategory] = useState('All')
  const products = [
    { id: 1, name: 'Wireless Headphones', price: 129, category: 'Electronics', emoji: '🎧' },
    { id: 2, name: 'Running Shoes', price: 89, category: 'Fashion', emoji: '👟' },
    { id: 3, name: 'Coffee Maker', price: 79, category: 'Home', emoji: '☕' },
    { id: 4, name: 'Mechanical Keyboard', price: 149, category: 'Electronics', emoji: '⌨️' },
    { id: 5, name: 'Yoga Mat', price: 45, category: 'Sports', emoji: '🧘' },
    { id: 6, name: 'Leather Wallet', price: 55, category: 'Fashion', emoji: '👜' },
  ]
  const cats = ['All', 'Electronics', 'Fashion', 'Home', 'Sports']
  const filtered = category === 'All' ? products : products.filter(p => p.category === category)
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <span className="font-black text-xl">ShopAI</span>
        <button className="relative px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium">
          🛒 Cart {cart > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{cart}</span>}
        </button>
      </header>
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-16 text-center">
        <h1 className="text-4xl font-black mb-3">Summer Sale — Up to 40% off</h1>
        <p className="text-indigo-200 mb-6">Free shipping on orders over $50</p>
        <button className="px-8 py-3 bg-white text-indigo-700 rounded-xl font-bold hover:opacity-90">Shop now</button>
      </div>
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex gap-2 mb-8 overflow-x-auto">
          {cats.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={\`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors \${category === c ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'}\`}>
              {c}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          {filtered.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col">
              <div className="bg-gray-50 rounded-xl aspect-square flex items-center justify-center text-5xl mb-4">{p.emoji}</div>
              <div className="text-xs text-gray-400 mb-1">{p.category}</div>
              <h3 className="font-semibold mb-2 flex-1">{p.name}</h3>
              <div className="flex items-center justify-between mt-2">
                <span className="font-bold text-lg">\${p.price}</span>
                <button onClick={() => setCart(c => c + 1)}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}`,
  },
  {
    name: 'Admin Dashboard',
    description: 'Sidebar navigation, KPI stat cards, and a recent activity data table',
    category: 'dashboard' as const,
    code: `import { useState } from 'react'
export default function App() {
  const [active, setActive] = useState('Overview')
  const nav = ['Overview','Analytics','Users','Revenue','Settings']
  const stats = [
    { label: 'Monthly Revenue', value: '$48,290', change: '+12.5%', up: true },
    { label: 'Active Users', value: '12,430', change: '+8.2%', up: true },
    { label: 'Conversion Rate', value: '3.6%', change: '+0.4%', up: true },
    { label: 'Churn Rate', value: '1.2%', change: '-0.3%', up: false },
  ]
  const rows = [
    { user: 'Alice Johnson', action: 'Upgraded to Pro', time: '2m ago', status: 'success' },
    { user: 'Bob Smith', action: 'Submitted support ticket', time: '15m ago', status: 'warning' },
    { user: 'Carol White', action: 'New signup', time: '1h ago', status: 'success' },
    { user: 'Dan Brown', action: 'Payment failed', time: '2h ago', status: 'error' },
    { user: 'Eve Davis', action: 'Exported report', time: '3h ago', status: 'info' },
  ]
  const statusStyle = {
    success: 'bg-green-500/20 text-green-400',
    warning: 'bg-yellow-500/20 text-yellow-400',
    error: 'bg-red-500/20 text-red-400',
    info: 'bg-blue-500/20 text-blue-400',
  }
  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex-col p-4 hidden md:flex shrink-0">
        <div className="font-black text-xl mb-8 px-2">Dash<span className="text-indigo-400">.</span></div>
        {nav.map(item => (
          <button key={item} onClick={() => setActive(item)}
            className={\`text-left px-3 py-2.5 rounded-lg text-sm mb-1 transition-colors \${active === item ? 'bg-indigo-600 text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-gray-800'}\`}>
            {item}
          </button>
        ))}
        <div className="mt-auto pt-4 border-t border-gray-800">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">A</div>
            <div><div className="text-sm font-medium">Admin</div><div className="text-xs text-gray-500">admin@app.com</div></div>
          </div>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">{active}</h1>
          <button className="px-4 py-2 bg-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-700">Export</button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-400 text-xs mb-1">{s.label}</p>
              <p className="text-2xl font-bold mb-1">{s.value}</p>
              <p className={\`text-xs font-medium \${s.up ? 'text-green-400' : 'text-red-400'}\`}>{s.change} vs last month</p>
            </div>
          ))}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="font-semibold">Recent Activity</h2>
            <span className="text-xs text-gray-400">{rows.length} events</span>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-gray-500 text-xs border-b border-gray-800">
              <th className="text-left px-6 py-3">User</th>
              <th className="text-left px-6 py-3">Action</th>
              <th className="text-left px-6 py-3">Status</th>
              <th className="text-right px-6 py-3">Time</th>
            </tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={i} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30">
                <td className="px-6 py-3 font-medium">{r.user}</td>
                <td className="px-6 py-3 text-gray-400">{r.action}</td>
                <td className="px-6 py-3"><span className={\`px-2 py-0.5 rounded-full text-xs font-medium \${statusStyle[r.status as keyof typeof statusStyle]}\`}>{r.status}</span></td>
                <td className="px-6 py-3 text-right text-gray-500">{r.time}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </main>
    </div>
  )
}`,
  },
]

export function seedDefaultTemplates(userId: string): void {
  // Idempotent — only seeds if table is empty
  const existing = db.select({ id: templates.id }).from(templates).get()
  if (existing) return

  for (const t of SEED_TEMPLATES) {
    const pagesSnapshot = JSON.stringify([{
      name: 'Home',
      slug: 'index',
      content: t.code,
      isHomePage: true,
      order: 0,
    }])

    db.insert(templates).values({
      id: generateId(),
      name: t.name,
      description: t.description,
      category: t.category,
      previewCode: t.code,
      pagesSnapshot,
      createdBy: userId,
      isPublic: true,
      usageCount: 0,
    }).run()
  }
}

// Re-export users so the NextAuth route can query the first admin
export { users }
