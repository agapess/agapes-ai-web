import { create } from 'zustand'

interface Project {
  id: string
  name: string
  slug: string
  status: string
}

interface Page {
  id: string
  projectId: string
  name: string
  slug: string
}

interface BuilderState {
  project: Project | null
  pages: Page[]
  activePage: Page | null
  previewCode: string
  previewSize: 'desktop' | 'tablet' | 'mobile'
  credits: number
  setProject: (project: Project) => void
  setPages: (pages: Page[]) => void
  setActivePage: (page: Page) => void
  setPreviewCode: (code: string) => void
  setPreviewSize: (size: 'desktop' | 'tablet' | 'mobile') => void
  setCredits: (credits: number) => void
}

export const useBuilderStore = create<BuilderState>((set) => ({
  project: null,
  pages: [],
  activePage: null,
  previewCode: '',
  previewSize: 'desktop',
  credits: 0,
  setProject: (project) => set({ project }),
  setPages: (pages) => set({ pages }),
  setActivePage: (activePage) => set({ activePage }),
  setPreviewCode: (previewCode) => set({ previewCode }),
  setPreviewSize: (previewSize) => set({ previewSize }),
  setCredits: (credits) => set({ credits }),
}))
