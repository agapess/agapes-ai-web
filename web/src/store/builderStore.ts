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
  setProject: (project) => set({ project }),
  setPages: (pages) => {
    const activePage = get().activePage
    set({
      pages,
      activePage: activePage ?? pages.find(p => p.isHomePage) ?? pages[0] ?? null,
    })
  },
  setActivePage: (page) => set({ activePage: page, previewCode: page.content || '' }),
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
}))
