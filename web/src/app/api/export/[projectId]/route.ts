import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects, pages } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import JSZip from 'jszip'

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
  const mainCode = typeof homePage?.content === 'string' && homePage.content
    ? homePage.content
    : `export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
      <h1 className="text-4xl font-bold">Welcome to ${project.name}</h1>
    </div>
  )
}`

  const zip = new JSZip()

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

  zip.file('vite.config.js', `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\nexport default defineConfig({ plugins: [react()] })`)
  zip.file('tailwind.config.js', `export default { content: ['./index.html', './src/**/*.{js,jsx}'], theme: { extend: {} }, plugins: [] }`)
  zip.file('postcss.config.js', `export default { plugins: { tailwindcss: {}, autoprefixer: {} } }`)

  const src = zip.folder('src')!
  src.file('main.jsx', `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App.jsx'\nimport './index.css'\nReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)`)
  src.file('index.css', `@tailwind base;\n@tailwind components;\n@tailwind utilities;`)
  src.file('App.jsx', mainCode)

  const otherPages = projectPages.filter(p => !p.isHomePage)
  for (const page of otherPages) {
    const code = typeof page.content === 'string' && page.content ? page.content : null
    if (code) {
      const componentName = page.name.replace(/[^a-zA-Z0-9]/g, '') || 'Page'
      src.file(`${componentName}.jsx`, code.replace(/export default function App\(\)/, `export default function ${componentName}()`))
    }
  }

  zip.file('README.md', `# ${project.name}\n\nGenerated with AI Website Builder.\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\nDeploy the \`dist/\` folder to Vercel, Netlify, or any static host.\n`)

  const content = await zip.generateAsync({ type: 'nodebuffer' })

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${project.slug}-export.zip"`,
    },
  })
}
