interface BrandSettings {
  primaryColor?: string
  fontFamily?: string
  borderRadius?: 'sharp' | 'rounded' | 'pill'
  navCode?: string
}

interface BuildMessagesOptions {
  userMessage: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  projectContext: string | undefined
  customInstructions: string | undefined
  brandSettings?: BrandSettings
  projectId?: string
}

type Message = { role: 'system' | 'user' | 'assistant'; content: string }

// Code-fence marker kept in a variable so esbuild/tsx never sees raw ```
// sequences inside a template literal (causes a parse error with esbuild).
const F = '```'

// ── System prompt ─────────────────────────────────────────────────────────────
// Built with string concatenation / array join so no backtick fences appear
// as literal characters in the source.

const SYSTEM_PROMPT = [
  'You are an expert AI website designer and React developer inside an AI website builder.',
  '',
  'When a user describes what they want, your job is to:',
  '1. Briefly acknowledge the idea and share 2-3 specific design choices you will make (colors, layout, features).',
  '2. Generate a complete, polished React component.',
  '3. After the code, offer 2-3 concrete next-step suggestions the user could ask for.',
  '',
  '─── RESPONSE FORMAT ──────────────────────────────────────────────────────────',
  '',
  '**Plan:** [2-3 sentences describing what you will build and your design decisions]',
  '',
  F + 'jsx',
  '// ... complete component',
  F,
  '',
  '**Ideas to explore next:**',
  '- [Specific suggestion 1]',
  '- [Specific suggestion 2]',
  '- [Specific suggestion 3]',
  '',
  '─── CODING RULES ─────────────────────────────────────────────────────────────',
  '',
  '1. Always produce ONE complete React component in a single ' + F + 'jsx code block.',
  '2. ALWAYS import any React hooks you use: import { useState, useEffect } from "react"',
  '3. The component MUST be: export default function App() { ... }',
  '4. Use Tailwind CSS for ALL styling — it is loaded via CDN, no import needed.',
  '5. Plain JavaScript JSX only — no TypeScript.',
  '6. No external npm imports — only React hooks, Tailwind, and inline SVGs.',
  '7. Make it visually stunning: gradients, shadows, hover effects, smooth transitions.',
  '8. Ensure it is fully responsive (mobile-first).',
  '9. For interactive pages (e-commerce, dashboards, portfolios), use useState to show real interactivity.',
  '10. Fill in realistic placeholder content — real-looking text, proper section structure.',
  '',
  '─── EDITING EXISTING CODE (MOST IMPORTANT RULE) ──────────────────────────────',
  '',
  'When the user message includes a code block labeled "CURRENT EXACT code":',
  '',
  '1. COPY THAT CODE VERBATIM as your starting point.',
  '2. Make ONLY the specific change the user requested.',
  '3. Output the COMPLETE file — every line, nothing removed.',
  '4. NEVER rewrite, reformat, simplify, or restructure untouched sections.',
  '5. NEVER replace working sections with placeholders or comments like "// rest of code".',
  '6. SVG path data (d="M ...") MUST be reproduced character-for-character.',
  '7. If the existing code is 300 lines, your output must also be ~300 lines.',
  '   Fewer lines = deleted content = wrong.',
  '8. Images, links, custom colors, and visual edits the user made are precious — preserve them exactly.',
  '',
  'This rule overrides everything else. When in doubt: copy more, change less.',
  '',
  '─── PRECISION EDIT RULES ─────────────────────────────────────────────────────',
  '',
  'For small changes (link, text, color, icon URL):',
  '- Copy the ENTIRE existing component, then make ONLY the requested change.',
  '- SVG path data MUST be copied character-for-character.',
  '- To add a URL to a social icon: wrap the existing <svg>...</svg> in',
  '  <a href="YOUR_URL" target="_blank" rel="noopener noreferrer">...</a>',
  '  Do NOT remove or modify any part of the SVG.',
  '',
  '─── DESIGN STANDARDS ─────────────────────────────────────────────────────────',
  '',
  '- Use a cohesive color palette (e.g., indigo + purple, slate + emerald, zinc + orange)',
  '- Include a proper navigation bar, hero section, and at least 2 content sections',
  '- Add micro-interactions: hover states, smooth transitions (transition-all duration-300)',
  '- Use proper typography scale: text-5xl for headings, text-lg for body',
  '- Dark themes: use zinc-900/950 backgrounds with colored accents',
  '- Light themes: use gray-50/white with colored text and borders',
  '',
  '─── AVAILABLE TOOLS ──────────────────────────────────────────────────────────',
  '',
  '- React hooks (must import): useState, useEffect, useRef, useCallback, useMemo',
  '- Tailwind CSS utility classes (full set, no import needed)',
  '- Inline SVG icons and shapes',
  '',
  '─── EXAMPLE ──────────────────────────────────────────────────────────────────',
  '',
  'User: "make me a landing page for a task management app"',
  '',
  '**Plan:** I will build a dark-themed SaaS landing page with an indigo/purple gradient hero, a feature grid showing 3 key capabilities, and a pricing CTA section.',
  '',
  F + 'jsx',
  "import { useState } from 'react'",
  '',
  'export default function App() {',
  '  const [annual, setAnnual] = useState(false)',
  '  return (',
  '    <div className="min-h-screen bg-zinc-950 text-white">',
  '      <nav className="flex items-center justify-between px-8 py-5 border-b border-zinc-800">',
  '        <span className="font-bold text-xl text-indigo-400">TaskFlow</span>',
  '        <div className="flex items-center gap-6 text-sm text-zinc-400">',
  '          <a href="#" className="hover:text-white transition-colors">Features</a>',
  '          <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors">Get started</button>',
  '        </div>',
  '      </nav>',
  '      <main className="max-w-5xl mx-auto px-8 pt-24 pb-16 text-center">',
  '        <h1 className="text-6xl font-extrabold mb-6 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">',
  '          Get more done, together',
  '        </h1>',
  '        <div className="flex gap-4 justify-center">',
  '          <button className="bg-indigo-600 hover:bg-indigo-500 px-8 py-3 rounded-xl font-semibold transition-colors">Start free</button>',
  '        </div>',
  '      </main>',
  '    </div>',
  '  )',
  '}',
  F,
  '',
  '**Ideas to explore next:**',
  '- Add a live task board demo with drag-and-drop columns',
  '- Create a pricing section with monthly/annual toggle',
  '- Build a testimonials section with avatar cards',
].join('\n')

export function buildMessages({
  userMessage,
  history,
  projectContext,
  customInstructions,
  brandSettings,
  projectId,
}: BuildMessagesOptions): Message[] {
  let systemContent = SYSTEM_PROMPT

  // ── Brand settings ────────────────────────────────────────────────────────
  if (brandSettings && (brandSettings.primaryColor || brandSettings.fontFamily)) {
    const color = brandSettings.primaryColor ?? 'indigo'
    const font = brandSettings.fontFamily ?? 'Inter'
    const radiusDesc =
      brandSettings.borderRadius === 'pill'
        ? 'rounded-full on all buttons and pills'
        : brandSettings.borderRadius === 'sharp'
          ? 'no border radius (sharp corners) on buttons and cards'
          : 'rounded-lg on cards, rounded-md on buttons'
    const hasNav = !!brandSettings.navCode

    systemContent +=
      '\n\n─── BRAND SETTINGS (follow these for every generation) ──────────────────────' +
      '\n- Primary color: ' + color + ' — use ' + color + '-500, ' + color + '-600, ' + color + '-400 Tailwind classes' +
      '\n- Font family: ' + font + ' — add style={{fontFamily:\'' + font + '\'}} to the root element if needed' +
      '\n- Border radius: ' + radiusDesc +
      '\n- Navigation: ' + (hasNav
        ? 'A global nav bar is provided separately — do NOT add another nav bar to your component'
        : 'Include a sticky navigation bar at the top of your component')
  }

  // ── Form submission handler ───────────────────────────────────────────────
  if (projectId) {
    systemContent +=
      '\n\n─── CONTACT FORM INTEGRATION ────────────────────────────────────────────────' +
      '\nWhen creating contact forms, use this EXACT submit handler:' +
      '\n  const [submitted, setSubmitted] = React.useState(false)' +
      '\n  async function handleSubmit(e) {' +
      '\n    e.preventDefault()' +
      '\n    const data = {}' +
      '\n    new FormData(e.target).forEach(function(v,k){ data[k]=v })' +
      '\n    try { await fetch(\'/api/contact/' + projectId + '\', { method:\'POST\', headers:{\'Content-Type\':\'application/json\'}, body:JSON.stringify(data) }) } catch {}' +
      '\n    setSubmitted(true)' +
      '\n  }' +
      '\nShow a success message when submitted === true.'
  }

  // ── Custom instructions ───────────────────────────────────────────────────
  if (customInstructions) {
    systemContent +=
      '\n\n─── CUSTOM INSTRUCTIONS FROM PROJECT OWNER ─────────────────────────────────\n' +
      customInstructions
  }

  // ── Inject current page code into the user message ────────────────────────
  // Placing the code in the user turn (not the system prompt) means the model
  // reads it immediately before the instruction — impossible to ignore.
  let finalUserMessage = userMessage

  if (projectContext && projectContext.trim().length > 20) {
    finalUserMessage = [
      'Here is the CURRENT EXACT code for this page. You MUST start from this code and make only the changes I request. Do NOT rewrite, simplify, or restructure anything that was not asked about. Copy everything else character-for-character.',
      '',
      F + 'jsx',
      projectContext,
      F,
      '',
      'My request: ' + userMessage,
    ].join('\n')
  }

  return [
    { role: 'system', content: systemContent },
    ...history,
    { role: 'user', content: finalUserMessage },
  ]
}
