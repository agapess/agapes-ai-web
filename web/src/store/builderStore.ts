import { create } from 'zustand'

export interface BuilderPage {
  id: string
  projectId: string
  name: string
  slug: string
  order: number
  content: string
  isHomePage: boolean
}

interface Project {
  id: string
  name: string
  slug: string
  status: string
  settings?: Record<string, unknown>
}

interface BuilderState {
  project: Project | null
  pages: BuilderPage[]
  activePage: BuilderPage | null
  previewCode: string
  previewSize: 'desktop' | 'tablet' | 'mobile'
  credits: number
  customInstructions: string
  projectSettings: Record<string, unknown>
  previewTheme: 'dark' | 'light'
  /** Controls which tab is shown in PreviewPanel — can be flipped externally (e.g. auto-switch after AI build) */
  activePreviewTab: 'preview' | 'code'
  setProject: (project: Project) => void
  setPages: (pages: BuilderPage[]) => void
  setActivePage: (page: BuilderPage) => void
  setPreviewCode: (code: string) => void
  setPreviewSize: (size: 'desktop' | 'tablet' | 'mobile') => void
  setCredits: (credits: number) => void
  updatePageContent: (pageId: string, code: string) => void
  setCustomInstructions: (instructions: string) => void
  setProjectSettings: (settings: Record<string, unknown>) => void
  setPreviewTheme: (theme: 'dark' | 'light') => void
  setActivePreviewTab: (tab: 'preview' | 'code') => void
}

export const useBuilderStore = create<BuilderState>((set, get) => ({
  project: null,
  pages: [],
  activePage: null,
  previewCode: '',
  previewSize: 'desktop',
  credits: 0,
  customInstructions: '',
  projectSettings: {},
  previewTheme: 'dark',
  activePreviewTab: 'preview',
  setProject: (project) => set({ project }),
  setPages: (pages) => {
    // Normalise all page content to strings so downstream code never sees [] or null
    const normPages = pages.map(p => ({
      ...p,
      content: typeof p.content === 'string' ? p.content : '',
    }))
    const currentActive = get().activePage
    // Keep active page reference current if it's already in the new list
    const newActive = currentActive
      ? (normPages.find(p => p.id === currentActive.id) ?? normPages.find(p => p.isHomePage) ?? normPages[0] ?? null)
      : (normPages.find(p => p.isHomePage) ?? normPages[0] ?? null)
    set({ pages: normPages, activePage: newActive })
    // Don't touch previewCode here — callers that want to switch preview call setActivePage
  },
  setActivePage: (page) => {
    const content = typeof page.content === 'string' ? page.content : ''
    set({ activePage: page, previewCode: content })
  },
  setPreviewCode: (previewCode) => set({ previewCode }),
  setPreviewSize: (previewSize) => set({ previewSize }),
  setCredits: (credits) => set({ credits }),
  updatePageContent: (pageId, code) => {
    const pages = get().pages.map(p => p.id === pageId ? { ...p, content: code } : p)
    set({ pages })
  },
  setCustomInstructions: (customInstructions) => set({ customInstructions }),
  setProjectSettings: (projectSettings) => set({ projectSettings }),
  setPreviewTheme: (previewTheme) => set({ previewTheme }),
  setActivePreviewTab: (activePreviewTab) => set({ activePreviewTab }),
}))
