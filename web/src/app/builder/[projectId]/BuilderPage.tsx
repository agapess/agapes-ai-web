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

interface Props {
  project: Project
  initialCredits: number
}

export default function BuilderPage({ project, initialCredits }: Props) {
  const { setProject, setCredits } = useBuilderStore()

  useEffect(() => {
    setProject(project)
    setCredits(initialCredits)
  }, [project, initialCredits, setProject, setCredits])

  return <BuilderLayout />
}
