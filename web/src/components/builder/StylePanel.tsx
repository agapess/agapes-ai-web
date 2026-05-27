'use client'
import { useState } from 'react'
import ComponentLibrary from './ComponentLibrary'
import PageManager from './PageManager'

type Tab = 'components' | 'pages'

export default function StylePanel() {
  const [tab, setTab] = useState<Tab>('components')

  return (
    <aside className="w-60 border-l border-border bg-card flex flex-col shrink-0">
      <div className="flex border-b border-border">
        {(['components', 'pages'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors capitalize ${
              tab === t
                ? 'text-foreground border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'components' ? <ComponentLibrary /> : <PageManager />}
      </div>
    </aside>
  )
}
