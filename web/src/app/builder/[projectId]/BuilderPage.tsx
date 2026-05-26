'use client'
import { useEffect } from 'react'
import { useBuilderStore } from '@/store/builderStore'
import BuilderLayout from '@/components/builder/BuilderLayout'

interface Project {
  id: string
  name: string
  slug: string
  status: string
}

export default function BuilderPage({ project }: { project: Project }) {
  const setProject = useBuilderStore(s => s.setProject)

  useEffect(() => {
    setProject(project)
  }, [project, setProject])

  return <BuilderLayout />
}
