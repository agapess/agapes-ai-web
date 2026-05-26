'use client'
import BuilderHeader from './BuilderHeader'
import ChatPanel from './ChatPanel'
import PreviewPanel from './PreviewPanel'
import StylePanel from './StylePanel'

export default function BuilderLayout() {
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <BuilderHeader />
      <div className="flex-1 flex overflow-hidden">
        <ChatPanel />
        <PreviewPanel />
        <StylePanel />
      </div>
    </div>
  )
}
