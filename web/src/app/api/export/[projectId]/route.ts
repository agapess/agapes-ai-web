import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects, pages } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import JSZip from 'jszip'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

export async function GET(_req: NextRequest, { params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = db.select().from(projects)
    .where(and(eq(projects.id, params.projectId), eq(projects.userId, session.user.id)))
    .get()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const projectPages = db.select().from(pages)
    .where(eq(pages.projectId, params.projectId))
    .all()
    .sort((a, b) => a.order - b.order)

  const homePage = projectPages.find(p => p.isHomePage) ?? projectPages[0]
  const rawMainCode = typeof homePage?.content === 'string' && homePage.content
    ? homePage.content
    : `export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
      <h1 className="text-4xl font-bold">Welcome to ${project.name}</h1>
    </div>
  )
}`

  const zip = new JSZip()

  // ── Collect uploaded images for this project ──────────────────────────────
  // Images are stored in public/uploads/<projectId>/ on disk.
  // In the exported ZIP they go into public/uploads/<projectId>/ so relative
  // src="/uploads/..." paths in JSX still work from the Vite dev server.
  const uploadDir = join(process.cwd(), 'public', 'uploads', params.projectId)
  let imageFiles: string[] = []
  try {
    imageFiles = (await readdir(uploadDir)).filter(f =>
      /\.(jpg|jpeg|png|gif|webp|svg|avif)$/i.test(f),
    )
  } catch {
    // No uploads directory yet — that's fine
  }

  const publicFolder = zip.folder('public')!
  if (imageFiles.length > 0) {
    const uploadsFolder = publicFolder.folder(`uploads/${params.projectId}`)!
    for (const filename of imageFiles) {
      try {
        const bytes = await readFile(join(uploadDir, filename))
        uploadsFolder.file(filename, bytes)
      } catch { /* skip unreadable files */ }
    }
  }

  // ── Rewrite absolute image URLs in JSX back to relative /uploads/ paths ─
  // The builder preview uses absolute URLs (window.location.origin + path) so
  // Sandpack can load them cross-origin. The exported project uses Vite which
  // serves from localhost, so relative paths work fine there.
  function normaliseCode(code: string): string {
    // Replace https?://...host.../uploads/ back to /uploads/
    return code.replace(/https?:\/\/[^/]+\/uploads\//g, '/uploads/')
  }

  const mainCode = normaliseCode(rawMainCode)

  zip.file('package.json', JSON.stringify({
    name: project.slug,
    private: true,
    version: '0.0.1',
    type: 'module',
    scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
    dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
    devDependencies: {
      '@vitejs/plugin-react': '^4.2.1',
      autoprefixer: '^10.4.19',
      postcss: '^8.4.38',
      tailwindcss: '^3.4.3',
      vite: '^5.2.0',
    },
  }, null, 2))

  zip.file('index.html', `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${project.name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`)

  zip.file('vite.config.js', `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  // Serve public/uploads alongside the app
  publicDir: 'public',
})`)
  zip.file('tailwind.config.js', `export default { content: ['./index.html', './src/**/*.{js,jsx}'], theme: { extend: {} }, plugins: [] }`)
  zip.file('postcss.config.js', `export default { plugins: { tailwindcss: {}, autoprefixer: {} } }`)

  // Get nav code from brand settings
  const projectSettings = project.settings as Record<string, unknown> | null
  const brandSettings = projectSettings?.brand as { navCode?: string } | undefined
  const navCode = brandSettings?.navCode ? normaliseCode(brandSettings.navCode) : null

  const src = zip.folder('src')!

  if (navCode) {
    src.file('SharedNav.jsx', navCode.replace(/export default function App\(\)/, 'export default function SharedNav()'))
    src.file('main.jsx', `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import SharedNav from './SharedNav.jsx'
import './index.css'
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <React.Fragment>
      <SharedNav />
      <App />
    </React.Fragment>
  </React.StrictMode>
)`)
  } else {
    src.file('main.jsx', `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App.jsx'\nimport './index.css'\nReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)`)
  }

  src.file('index.css', `@tailwind base;\n@tailwind components;\n@tailwind utilities;`)
  src.file('App.jsx', mainCode)

  const otherPages = projectPages.filter(p => !p.isHomePage)
  for (const page of otherPages) {
    const rawCode = typeof page.content === 'string' && page.content ? page.content : null
    if (rawCode) {
      const componentName = page.name.replace(/[^a-zA-Z0-9]/g, '') || 'Page'
      src.file(
        `${componentName}.jsx`,
        normaliseCode(rawCode).replace(
          /export default function App\(\)/,
          `export default function ${componentName}()`,
        ),
      )
    }
  }

  const imageNote = imageFiles.length > 0
    ? `\n## Images\n\nYour uploaded images are included in \`public/uploads/${params.projectId}/\`.\nThey are referenced with relative paths (e.g. \`src="/uploads/${params.projectId}/photo.jpg"\`) and will work automatically.\n`
    : ''

  zip.file('README.md', `# ${project.name}

Generated with **Agapes AI Website Builder**.
${imageNote}
## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Deploy

Build a production bundle and deploy the \`dist/\` folder to any static host:

\`\`\`bash
npm run build
\`\`\`

Hosts: [Vercel](https://vercel.com), [Netlify](https://netlify.com), [Cloudflare Pages](https://pages.cloudflare.com)
`)

  const content = await zip.generateAsync({ type: 'nodebuffer' })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NextResponse(content as any, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${project.slug}-export.zip"`,
    },
  })
}
