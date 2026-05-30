'use client'
import { useState, useEffect } from 'react'
import { useBuilderStore } from '@/store/builderStore'
import ComponentLibrary from './ComponentLibrary'
import PageManager from './PageManager'
import ProjectSettingsPanel from './ProjectSettingsPanel'
import VisualEditorPanel from './VisualEditorPanel'

type Tab = 'visual' | 'components' | 'pages' | 'settings'

const TAB_LABELS: Record<Tab, string> = {
  visual: '⬡',
  components: 'Sections',
  pages: 'Pages',
  settings: '⚙',
}

export default function StylePanel() {
  const [tab, setTab] = useState<Tab>('components')
  const { visualEditMode } = useBuilderStore()

  // Auto-switch to Visual tab when visual edit mode is enabled
  useEffect(() => {
    if (visualEditMode) setTab('visual')
  }, [visualEditMode])

  return (
    <aside className="w-60 border-l border-border bg-card flex flex-col shrink-0">
      <div className="flex border-b border-border">
        {(['visual', 'components', 'pages', 'settings'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              tab === t
                ? 'text-foreground border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            } ${t === 'visual' && visualEditMode ? 'text-indigo-400' : ''}`}
            title={t === 'visual' ? 'Visual Editor' : undefined}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'visual'      && <VisualEditorPanel />}
        {tab === 'components'  && <ComponentLibrary />}
        {tab === 'pages'       && <PageManager />}
        {tab === 'settings'    && <ProjectSettingsPanel />}
      </div>
    </aside>
  )
}
