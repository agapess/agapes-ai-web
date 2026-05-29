'use client'
import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview,
  SandpackCodeEditor,
} from '@codesandbox/sandpack-react'
import { useBuilderStore } from '@/store/builderStore'
import { useState, useEffect, useRef } from 'react'

const DEFAULT_CODE = `export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-purple-900 flex items-center justify-center">
      <div className="text-center text-white px-6">
        <h1 className="text-5xl font-bold mb-4">Your website starts here</h1>
        <p className="text-purple-200 text-lg">Chat with AI to build your website. Your live preview will appear here.</p>
      </div>
    </div>
  )
}`

const PREVIEW_WIDTHS = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
}

export default function PreviewPanel() {
  const { previewCode, previewSize, previewTheme, setPreviewTheme } = useBuilderStore()
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview')
  const [fullscreen, setFullscreen] = useState(false)
  const [containerHeight, setContainerHeight] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const code = previewCode || DEFAULT_CODE

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fullscreen) setFullscreen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [fullscreen])

  // Measure the real pixel height of the container so Sandpack gets an explicit px value
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height)
      }
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const sandpackHeight = containerHeight > 0 ? `${containerHeight}px` : '100%'

  return (
    <div className={`flex flex-col bg-zinc-950 overflow-hidden ${fullscreen ? 'fixed inset-0 z-50' : 'flex-1'}`}>
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-card shrink-0">
        {(['preview', 'code'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
              activeTab === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'preview' ? 'Preview' : 'Code'}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setPreviewTheme(previewTheme === 'dark' ? 'light' : 'dark')}
            title={`Switch to ${previewTheme === 'dark' ? 'light' : 'dark'} mode`}
            className="px-2 py-1 text-xs rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            {previewTheme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            onClick={() => setFullscreen(!fullscreen)}
            title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
            className="px-2 py-1 text-xs rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            {fullscreen ? '⊠' : '⊞'}
          </button>
        </div>
      </div>

      {/* Measured container — ResizeObserver reads its real pixel height */}
      <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden flex justify-center">
        <div
          className="transition-all duration-300"
          style={{
            width: fullscreen ? '100%' : PREVIEW_WIDTHS[previewSize],
            maxWidth: '100%',
            height: sandpackHeight,
          }}
        >
          <SandpackProvider
            template="react"
            theme={previewTheme === 'light' ? 'light' : 'dark'}
            files={{ '/App.js': code }}
            options={{ externalResources: ['https://cdn.tailwindcss.com'] }}
          >
            <SandpackLayout style={{ height: sandpackHeight, borderRadius: 0 }}>
              {activeTab === 'preview' ? (
                <SandpackPreview
                  style={{ height: sandpackHeight }}
                  showOpenInCodeSandbox={false}
                  showNavigator={false}
                />
              ) : (
                <SandpackCodeEditor style={{ height: sandpackHeight }} showLineNumbers />
              )}
            </SandpackLayout>
          </SandpackProvider>
        </div>
      </div>

      {fullscreen && (
        <div className="absolute top-14 right-4 text-xs text-muted-foreground pointer-events-none">
          Press <kbd className="px-1 py-0.5 bg-secondary rounded text-foreground">Esc</kbd> to exit
        </div>
      )}
    </div>
  )
}
