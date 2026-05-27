'use client'
import { useEffect } from 'react'
import { useBuilderStore, type BuilderPage } from '@/store/builderStore'
import BuilderLayout from '@/components/builder/BuilderLayout'

interface Project {
  id: string
  name: string
  slug: string
  status: string
}

interface Props {
  project: Project
  initialPages: BuilderPage[]
  initialCredits: number
}

export default function BuilderPage({ project, initialPages, initialCredits }: Props) {
  const { setProject, setPages, setCredits, setActivePage } = useBuilderStore()

  useEffect(() => {
    setProject(project)
    setCredits(initialCredits)
    setPages(initialPages)
    const homePage = initialPages.find(p => p.isHomePage) ?? initialPages[0]
    if (homePage) {
      setActivePage(homePage)
    }
  }, [project, initialPages, initialCredits, setProject, setPages, setCredits, setActivePage])

  return <BuilderLayout />
}
