'use client'
import { useMemo } from 'react'

interface Props {
  code: string
}

/**
 * Renders a scaled-down live preview of a React component using an srcdoc iframe.
 * Much lighter than Sandpack for thumbnail purposes — no sandbox runtime needed.
 */
export default function ProjectThumbnail({ code }: Props) {
  const srcdoc = useMemo(() => {
    // Build a self-contained HTML page that renders the component
    // Using Babel standalone + React UMD for a lightweight render
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; }
    #root { width: 100%; min-height: 100vh; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-type="module">
    const { useState, useEffect, useRef, useCallback, useMemo } = React;
    ${code.replace(/<\/script>/g, '<\\/script>')}
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(App));
  </script>
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
