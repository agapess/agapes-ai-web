import { create } from 'zustand'

export interface BuilderPage {
  id: string
  projectId: string
  name: string
  slug: string
  order: number
  content: string
  isHomePage: boolean
  seoTitle?: string
  seoDescription?: string
}

export interface SelectedElement {
  bid: string
  tagName: string
  className: string
  textContent: string
  rect: { top: number; left: number; width: number; height: number }
  sectionBid: string | null
  /** Nearest <a> ancestor, if any — used for editing icon links */
  nearestAnchor?: { bid: string | null; href: string; className: string } | null
}

interface Project {
  id: string
  name: string
  slug: string
  status: string
  settings?: Record<string, unknown>
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface ProviderOption {
  id: string
  provider: string
  displayName: string
  model: string | null
  isDefault: boolean
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
  /** Controls which tab is shown in PreviewPanel */
  activePreviewTab: 'preview' | 'code'
  /** Visual editor mode — click-to-select elements */
  visualEditMode: boolean
  /** Currently selected element in visual editor */
  selectedElement: SelectedElement | null
  /** Autosave status indicator */
  saveStatus: SaveStatus
  /** Shared nav component JSX (empty string = none) */
  navCode: string
  /** Available AI provider configs (loaded once) */
  providers: ProviderOption[]
  /** Currently selected provider ID (empty = auto) */
  selectedProviderId: string

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
  setVisualEditMode: (on: boolean) => void
  setSelectedElement: (el: SelectedElement | null) => void
  setSaveStatus: (status: SaveStatus) => void
  setNavCode: (code: string) => void
  setProviders: (providers: ProviderOption[]) => void
  setSelectedProviderId: (id: string) => void
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
  visualEditMode: false,
  selectedElement: null,
  saveStatus: 'idle',
  navCode: '',
  providers: [],
  selectedProviderId: '',

  setProject: (project) => set({ project }),
  setPages: (pages) => {
    const normPages = pages.map(p => ({
      ...p,
      content: typeof p.content === 'string' ? p.content : '',
    }))
    const currentActive = get().activePage
    const newActive = currentActive
      ? (normPages.find(p => p.id === currentActive.id) ?? normPages.find(p => p.isHomePage) ?? normPages[0] ?? null)
      : (normPages.find(p => p.isHomePage) ?? normPages[0] ?? null)
    set({ pages: normPages, activePage: newActive })
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
  setVisualEditMode: (visualEditMode) => set({ visualEditMode, selectedElement: null }),
  setSelectedElement: (selectedElement) => set({ selectedElement }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  setNavCode: (navCode) => set({ navCode }),
  setProviders: (providers) => set({ providers }),
  setSelectedProviderId: (selectedProviderId) => set({ selectedProviderId }),
}))
