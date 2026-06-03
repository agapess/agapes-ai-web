'use client'
import { useMemo } from 'react'

interface Props {
  code: string
}

/**
 * Renders a scaled-down live preview of a React component using an srcdoc iframe.
 * Strips ES module imports/exports and uses React UMD globals + Babel standalone.
 */
export default function ProjectThumbnail({ code }: Props) {
  const srcdoc = useMemo(() => {
    // Transform the component code for browser execution:
    // 1. Strip import statements (React is available as UMD global)
    // 2. Convert "export default function App" → "function App"
    // 3. Handle edge cases with </script> in the code
    const transformed = code
      // Remove import lines
      .replace(/^\s*import\s+.*?['"].*?['"];?\s*$/gm, '')
      // Remove "export default " prefix from function/class/const declarations
      .replace(/export\s+default\s+function/g, 'function')
      .replace(/export\s+default\s+class/g, 'class')
      .replace(/export\s+default\s+/g, 'const App = ')
      // Escape </script> inside the code
      .replace(/<\/script>/g, '<\\/script>')

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; background: #09090b; }
    #root { width: 100%; min-height: 100vh; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect, useRef, useCallback, useMemo, useReducer, useContext, createContext, Fragment } = React;
    try {
      ${transformed}
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(App));
    } catch(e) {
      document.getElementById('root').innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#71717a;font-size:12px;">Preview unavailable</div>';
    }
  <\/script>
</body>
</html>`
  }, [code])

  return (
    <iframe
      srcDoc={srcdoc}
      className="w-full h-full pointer-events-none select-none"
      style={{ transform: 'scale(0.35)', transformOrigin: 'top left', width: '286%', height: '286%' }}
      sandbox="allow-scripts"
      loading="lazy"
      tabIndex={-1}
      title="Project preview"
    />
  )
}
