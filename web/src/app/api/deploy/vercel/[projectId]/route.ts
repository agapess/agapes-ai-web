import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects, pages, users } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { decrypt, getEncryptionSecret } from '@/lib/encryption'

const VERCEL_API = 'https://api.vercel.com'

export async function POST(_req: NextRequest, { params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = db.select().from(projects)
    .where(and(eq(projects.id, params.projectId), eq(projects.userId, session.user.id)))
    .get()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const user = db.select({ settings: users.settings }).from(users)
    .where(eq(users.id, session.user.id))
    .get()

  const userSettings = (user?.settings as Record<string, unknown>) ?? {}
  const encryptedToken = userSettings.vercelToken as string | undefined

  if (!encryptedToken) {
    return NextResponse.json({ error: 'Vercel token not configured. Go to Settings → Deploy.' }, { status: 400 })
  }

  const vercelToken = decrypt(encryptedToken, getEncryptionSecret())
  if (!vercelToken) {
    return NextResponse.json({ error: 'Invalid Vercel token. Please re-enter it in Settings → Deploy.' }, { status: 400 })
  }

  const projectPages = db.select().from(pages)
    .where(eq(pages.projectId, params.projectId))
    .all()
    .sort((a, b) => a.order - b.order)

  const homePage = projectPages.find(p => p.isHomePage) ?? projectPages[0]
  const mainCode = typeof homePage?.content === 'string' && homePage.content
    ? homePage.content
    : `export default function App() { return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white"><h1 className="text-4xl font-bold">Welcome to ${project.name}</h1></div> }`

  const enc = (content: string) => ({ data: content, encoding: 'utf-8' as const })

  const files = [
    { file: 'package.json', ...enc(JSON.stringify({
      name: project.slug, private: true, version: '0.0.1', type: 'module',
      scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
      dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
      devDependencies: { '@vitejs/plugin-react': '^4.2.1', autoprefixer: '^10.4.19', postcss: '^8.4.38', tailwindcss: '^3.4.3', vite: '^5.2.0' },
    }, null, 2)) },
    { file: 'index.html', ...enc(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${project.name}</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>`) },
    { file: 'vite.config.js', ...enc(`import{defineConfig}from'vite';import react from'@vitejs/plugin-react';export default defineConfig({plugins:[react()]})`) },
    { file: 'tailwind.config.js', ...enc(`export default{content:['./index.html','./src/**/*.{js,jsx}'],theme:{extend:{}},plugins:[]}`) },
    { file: 'postcss.config.js', ...enc(`export default{plugins:{tailwindcss:{},autoprefixer:{}}}`) },
    { file: 'src/main.jsx', ...enc(`import React from'react';import ReactDOM from'react-dom/client';import App from'./App.jsx';import'./index.css';ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>)`) },
    { file: 'src/index.css', ...enc(`@tailwind base;@tailwind components;@tailwind utilities;`) },
    { file: 'src/App.jsx', ...enc(mainCode) },
  ]

  for (const page of projectPages.filter(p => !p.isHomePage)) {
    const code = typeof page.content === 'string' && page.content ? page.content : null
    if (code) {
      const name = page.name.replace(/[^a-zA-Z0-9]/g, '') || 'Page'
      files.push({ file: `src/${name}.jsx`, ...enc(code.replace(/export default function App\(\)/, `export default function ${name}()`)) })
    }
  }

  const deployRes = await fetch(`${VERCEL_API}/v13/deployments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${vercelToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: project.slug,
      files,
      projectSettings: { framework: 'vite', buildCommand: 'vite build', outputDirectory: 'dist', installCommand: 'npm install' },
      target: 'production',
    }),
  })

  if (!deployRes.ok) {
    const err = await deployRes.json().catch(() => ({})) as { error?: { message?: string } }
    return NextResponse.json({ error: err.error?.message ?? 'Vercel deployment failed' }, { status: deployRes.status })
  }

  const deployment = await deployRes.json() as { url: string; id: string }
  return NextResponse.json({ url: `https://${deployment.url}`, deploymentId: deployment.id })
}
