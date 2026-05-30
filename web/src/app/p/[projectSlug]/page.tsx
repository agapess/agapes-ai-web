import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { projects, pages } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import PublishedView from './PublishedView'

export const dynamic = 'force-dynamic'

interface Props {
  params: { projectSlug: string }
  searchParams: { page?: string }
}

export default async function PublishedPage({ params, searchParams }: Props) {
  // Find published project by slug
  const project = db
    .select()
    .from(projects)
    .where(and(eq(projects.slug, params.projectSlug), eq(projects.status, 'published')))
    .get()

  if (!project) {
    redirect('/')
  }

  // Load all pages, sorted by order
  const projectPages = db
    .select()
    .from(pages)
    .where(eq(pages.projectId, project.id))
    .all()
    .sort((a, b) => a.order - b.order)

  // Determine which page to show
  let targetPage = searchParams.page
    ? projectPages.find(p => p.slug === searchParams.page)
    : null

  if (!targetPage) {
    targetPage = projectPages.find(p => p.isHomePage) ?? projectPages[0]
  }

  const code = typeof targetPage?.content === 'string' && targetPage.content.trim()
    ? targetPage.content
    : `export default function App() {
  return (
    <div style={{minHeight:'100vh',background:'#0a0a0a',display:'flex',alignItems:'center',justifyContent:'center',color:'white'}}>
      <div style={{textAlign:'center'}}>
        <h1 style={{fontSize:'2rem',fontWeight:'bold',marginBottom:'1rem'}}>${project.name}</h1>
        <p style={{color:'#888'}}>This site is under construction.</p>
      </div>
    </div>
  )
}`

  // Get nav code from brand settings
  const settings = project.settings as Record<string, unknown> | null
  const brand = settings?.brand as { navCode?: string } | undefined
  const navCode = brand?.navCode ?? ''

  const seoTitle = targetPage?.seoTitle ?? project.name
  const seoDesc = targetPage?.seoDescription ?? `${project.name} — built with Agapes AI Website`

  return (
    <>
      <head>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDesc} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDesc} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <PublishedView code={code} projectName={project.name} navCode={navCode || undefined} />
    </>
  )
}
