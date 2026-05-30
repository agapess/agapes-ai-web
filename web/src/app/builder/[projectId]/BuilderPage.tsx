'use client'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useBuilderStore, type BuilderPage } from '@/store/builderStore'
import { useChatStore } from '@/store/chatStore'
import BuilderLayout from '@/components/builder/BuilderLayout'

interface Project {
  id: string
  name: string
  slug: string
  status: string
  settings?: Record<string, unknown>
}

interface Props {
  project: Project
  initialPages: BuilderPage[]
  initialCredits: number
}

export default function BuilderPage({ project, initialPages, initialCredits }: Props) {
  const {
    setProject,
    setPages,
    setCredits,
    setActivePage,
    setCustomInstructions,
    setProjectSettings,
    setPreviewCode,
    setActivePreviewTab,
  } = useBuilderStore()

  const { clearMessages, addMessage } = useChatStore()

  // Track which project is currently loaded so we only reset/reload on actual change
  const loadedProjectId = useRef<string | null>(null)

  // Synchronously clear stale state before first paint so the user never sees
  // the previous project's chat or preview code flash up for a frame
  useLayoutEffect(() => {
    if (loadedProjectId.current !== project.id) {
      clearMessages()
      setPreviewCode('')
    }
  }, [project.id, clearMessages, setPreviewCode])

  useEffect(() => {
    // Only reset and reload when the project actually changes
    if (loadedProjectId.current === project.id) return
    loadedProjectId.current = project.id

    // ── 1. Reset builder state for this project ──────────────────────────
    setProject(project)
    setCredits(initialCredits)

    // Normalise page content: drizzle mode:json defaults to [] for new pages
    const normalisedPages = initialPages.map(p => ({
      ...p,
      content: typeof p.content === 'string' ? p.content : '',
    }))
    setPages(normalisedPages)

    const settings = project.settings ?? {}
    setProjectSettings(settings)
    setCustomInstructions(typeof settings.customInstructions === 'string' ? settings.customInstructions : '')

    const homePage = normalisedPages.find(p => p.isHomePage) ?? normalisedPages[0] ?? null
    if (homePage) {
      setActivePage(homePage)
      // Set the preview code explicitly so Sandpack gets a string immediately
      setPreviewCode(typeof homePage.content === 'string' && homePage.content.trim() ? homePage.content : '')
    } else {
      setPreviewCode('')
    }

    setActivePreviewTab('preview')

    // ── Load brand/nav settings ──────────────────────────────────────────
    const brandSettings = settings.brand as { navCode?: string } | undefined
    if (brandSettings?.navCode) {
      useBuilderStore.getState().setNavCode(brandSettings.navCode)
    } else {
      useBuilderStore.getState().setNavCode('')
    }

    // ── 2. Reset chat store and reload history for this project ──────────
    clearMessages()

    fetch(`/api/chat-sessions/${project.id}`)
      .then(r => r.json())
      .then((data: { messages?: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number; generatedCode?: string }> }) => {
        if (Array.isArray(data.messages)) {
          for (const msg of data.messages) {
            // Only restore user and assistant messages (skip system)
            if (msg.role === 'user' || msg.role === 'assistant') {
              addMessage({
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp ?? Date.now(),
                generatedCode: msg.generatedCode,
              })
            }
          }
        }
      })
      .catch(() => { /* no history yet — that's fine */ })

  }, [
    project,
    initialPages,
    initialCredits,
    setProject,
    setPages,
    setCredits,
    setActivePage,
    setCustomInstructions,
    setProjectSettings,
    setPreviewCode,
    setActivePreviewTab,
    clearMessages,
    addMessage,
  ])

  // Show onboarding wizard if project hasn't been set up and has no content
  const settings = project.settings ?? {}
  const hasContent = initialPages.some(p => typeof p.content === 'string' && p.content.trim().length > 50)
  const showWizard = !settings.onboardingComplete && !hasContent

  return <BuilderLayout showWizard={showWizard} />
}
