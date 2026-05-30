'use client'
import { useState } from 'react'
import BuilderHeader from './BuilderHeader'
import ChatPanel from './ChatPanel'
import PreviewPanel from './PreviewPanel'
import StylePanel from './StylePanel'
import OnboardingWizard from './OnboardingWizard'

interface Props {
  showWizard?: boolean
}

export default function BuilderLayout({ showWizard: initialShowWizard = false }: Props) {
  const [showWizard, setShowWizard] = useState(initialShowWizard)

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <BuilderHeader />
      <div className="flex-1 flex overflow-hidden">
        <ChatPanel />
        <PreviewPanel />
        <StylePanel />
      </div>
      {showWizard && <OnboardingWizard onComplete={() => setShowWizard(false)} />}
    </div>
  )
}
