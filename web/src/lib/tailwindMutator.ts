/**
 * Tailwind class mutation utilities.
 * All functions are pure — they take code + element info and return updated code.
 */

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ── Classifier helpers ────────────────────────────────────────────────────────

const SIZE_CLASSES = new Set([
  'text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl',
  'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl', 'text-6xl',
  'text-7xl', 'text-8xl', 'text-9xl',
])

const COLOR_NAMES = new Set([
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
  'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink',
  'rose', 'gray', 'zinc', 'slate', 'neutral', 'stone',
  'white', 'black', 'transparent', 'current', 'inherit',
])

function isTextSizeClass(cls: string): boolean {
  return SIZE_CLASSES.has(cls)
}

function isColorClass(cls: string, prefix: string): boolean {
  if (!cls.startsWith(prefix)) return false
  const suffix = cls.slice(prefix.length)
  // "white", "black", "transparent" etc.
  if (COLOR_NAMES.has(suffix)) return true
  // "red-500", "indigo-600", etc.
  const dashIdx = suffix.lastIndexOf('-')
  if (dashIdx < 0) return false
  const colorName = suffix.slice(0, dashIdx)
  const shade = suffix.slice(dashIdx + 1)
  return COLOR_NAMES.has(colorName) && /^\d+$/.test(shade)
}

// ── Core mutation ─────────────────────────────────────────────────────────────

/**
 * Swap Tailwind utility classes on a specific element in JSX code.
 *
 * @param code             Full JSX source
 * @param tagName          Tag to target, e.g. 'h1', 'button'
 * @param originalClassName The exact className string the element currently has
 * @param prefix           Prefix family to replace, e.g. 'bg-', 'text-', 'font-'
 * @param newValue         Full new class to add, e.g. 'bg-indigo-600' ('' to just remove)
 * @param mode             'color' | 'size' | 'any'
 *                          color → only remove text-{color}-{shade} classes under text- prefix
 *                          size  → only remove text-{size} classes under text- prefix
 *                          any   → remove all classes starting with prefix
 */
export function swapTailwindClass(
  code: string,
  tagName: string,
  originalClassName: string,
  prefix: string,
  newValue: string,
  mode: 'color' | 'size' | 'any' = 'any',
): string {
  const classes = originalClassName.split(/\s+/).filter(Boolean)

  const filtered = classes.filter(cls => {
    const normalPrefix = prefix === 'rounded' ? 'rounded' : prefix
    if (!cls.startsWith(normalPrefix)) return true  // keep — not this family

    if (prefix === 'text-') {
      if (mode === 'color') return !isColorClass(cls, 'text-')
      if (mode === 'size')  return !isTextSizeClass(cls)
    }
    if (prefix === 'rounded') return !cls.startsWith('rounded') // covers rounded, rounded-*, rounded-full
    return false  // remove — matches the prefix family
  })

  if (newValue) filtered.push(newValue)
  const newClassName = filtered.join(' ')

  // Replace the className attribute value in the source
  const escapedOld = escapeRegex(originalClassName)

  // Match:  <tagName ...className="OLD"...>  (double or single quotes)
  const re = new RegExp(
    `(<${tagName}(?:\\s[^>]*)? className=["'])${escapedOld}(["'])`,
    'g',
  )
  return code.replace(re, `$1${newClassName}$2`)
}

/**
 * Replace every occurrence of `oldText` with `newText` in the JSX source.
 * Used for editing text content inside elements.
 */
export function replaceText(code: string, oldText: string, newText: string): string {
  const escaped = escapeRegex(oldText)
  return code.replace(new RegExp(escaped, 'g'), newText)
}
