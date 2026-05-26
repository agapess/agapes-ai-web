'use client'
import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview,
  SandpackCodeEditor,
} from '@codesandbox/sandpack-react'
import { useBuilderStore } from '@/store/builderStore'
import { useState } from 'react'

const DEFAULT_CODE = `export default function App() {
  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', background: '#0f172a', minHeight: '100vh', color: 'white' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>Your website starts here</h1>
      <p style={{ color: '#94a3b8', marginTop: '1rem' }}>
        Chat with AI to build your website. Your live preview will appear here.
      </p>
    </div>
  )
}`

const PREVIEW_WIDTHS = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
}

export default function PreviewPanel() {
  const { previewCode, previewSize } = useBuilderStore()
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview')
  const code = previewCode || DEFAULT_CODE

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-card shrink-0">
        {(['preview', 'code'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
              activeTab === tab
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'preview' ? 'Preview' : 'Code'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden flex items-start justify-center pt-4">
        <div
          className="h-full transition-all duration-300"
          style={{ width: PREVIEW_WIDTHS[previewSize] }}
        >
          <SandpackProvider
            template="react"
            theme="dark"
            files={{
              '/App.js': code,
            }}
            options={{
              externalResources: ['https://cdn.tailwindcss.com'],
            }}
          >
            <SandpackLayout style={{ height: '100%', borderRadius: 0 }}>
              {activeTab === 'preview' ? (
                <SandpackPreview style={{ height: '100%' }} showOpenInCodeSandbox={false} />
              ) : (
                <SandpackCodeEditor style={{ height: '100%' }} showLineNumbers />
              )}
            </SandpackLayout>
          </SandpackProvider>
        </div>
      </div>
    </div>
  )
}
