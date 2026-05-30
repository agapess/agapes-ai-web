'use client'
import { SandpackProvider, SandpackPreview } from '@codesandbox/sandpack-react'

interface Props {
  code: string
  projectName: string
  navCode?: string
}

const NAV_INDEX = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Nav from './SharedNav';
var root = createRoot(document.getElementById('root'));
root.render(React.createElement(React.Fragment, null, React.createElement(Nav), React.createElement(App)));
`

export default function PublishedView({ code, projectName, navCode }: Props) {
  const files: Record<string, string> = { '/App.js': code }
  if (navCode) {
    files['/SharedNav.js'] = navCode
    files['/index.js'] = NAV_INDEX
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <SandpackProvider
        template="react"
        theme="dark"
        files={files}
        options={{ externalResources: ['https://cdn.tailwindcss.com'] }}
      >
        <SandpackPreview
          style={{ width: '100%', height: '100vh' }}
          showOpenInCodeSandbox={false}
          showNavigator={false}
        />
      </SandpackProvider>
    </div>
  )
}
