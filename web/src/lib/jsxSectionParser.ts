/**
 * JSX section parser — pure string-manipulation utilities.
 * Extracts and manipulates top-level section elements inside the
 * `return (...)` of a React App component.
 *
 * Assumptions (always true for AI-generated code in this builder):
 *   • Single `export default function App()` with one `return (…)`.
 *   • Return value is a single root wrapper (div/main/etc.) whose
 *     direct children are the page sections we care about.
 *   • JSX is plain JS — no TypeScript generics in JSX position.
 */

export interface JsxSection {
  start: number   // index in code string (inclusive)
  end: number     // index in code string (exclusive)
  source: string  // raw JSX text of this section
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Find the '>' that closes a JSX opening tag, respecting { } in attribute
 * expressions (e.g.  className={x > 0 ? 'a' : 'b'}).
 */
function findTagClose(code: string, from: number): number {
  let i = from
  let braceDepth = 0
  while (i < code.length) {
    const ch = code[i]
    if (ch === '{') braceDepth++
    else if (ch === '}') braceDepth--
    else if (ch === '>' && braceDepth === 0) return i
    i++
  }
  return code.length - 1
}

/**
 * Given the opening '<' of the root wrapper (e.g. '<div className="...">'),
 * return the index of the first character of its content (after the '>').
 */
function findRootDivContentStart(code: string, fromIdx: number): number {
  return findTagClose(code, fromIdx) + 1
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Extract all top-level JSX section elements from an App component.
 *
 * Strategy:
 *   1. Find `return (` or `return(\n`
 *   2. Find the root wrapper's opening `<tag` (first '<' after return)
 *   3. Skip past the root wrapper's opening tag to its content start
 *   4. Walk forward, collecting each top-level child using a depth counter
 *      that tracks ALL tags (not just same-name), so nested divs are handled
 */
export function extractSections(code: string): JsxSection[] {
  // 1. Find return (
  const returnMatch = code.match(/return\s*\(\s*/)
  if (!returnMatch) return []
  const returnStart = (code.indexOf(returnMatch[0]) + returnMatch[0].length)

  // 2. Find root wrapper's '<'
  const rootTagStart = code.indexOf('<', returnStart)
  if (rootTagStart < 0) return []

  // 3. Find content start (after the root wrapper's '>')
  const contentStart = findRootDivContentStart(code, rootTagStart)
  if (contentStart < 0) return []

  const sections: JsxSection[] = []
  let i = contentStart

  outer: while (i < code.length) {
    // Skip whitespace / newlines between sections
    while (i < code.length && /[\s\n\r]/.test(code[i])) i++

    // Hit the root closing tag → we're done
    if (code[i] === '<' && code[i + 1] === '/') break
    // Not a JSX element (e.g. a text node or expression)
    if (code[i] !== '<') { i++; continue }

    const sectionStart = i

    // Validate: must start with a letter (JSX tag, not comment/doctype)
    if (!/[A-Za-z]/.test(code[i + 1])) { i++; continue }

    // Walk to find the matching close, tracking depth of ALL tags
    let depth = 0
    let j = i

    while (j < code.length) {
      if (code[j] !== '<') { j++; continue }

      // HTML/JSX comment: <!-- ... -->
      if (code[j + 1] === '!' && code[j + 2] === '-' && code[j + 3] === '-') {
        const end = code.indexOf('-->', j)
        j = end > 0 ? end + 3 : j + 1
        continue
      }

      // Closing tag </…>
      if (code[j + 1] === '/') {
        if (depth === 0) {
          // This closes OUR section
          const closeEnd = code.indexOf('>', j) + 1
          sections.push({ start: sectionStart, end: closeEnd, source: code.slice(sectionStart, closeEnd) })
          i = closeEnd
          continue outer
        }
        depth--
        j = Math.max(j + 1, code.indexOf('>', j) + 1)
        continue
      }

      // Opening tag (or self-closing)
      if (/[A-Za-z{]/.test(code[j + 1])) {
        const gtPos = findTagClose(code, j)
        const isSelfClose = code[gtPos - 1] === '/'
        if (!isSelfClose) depth++
        j = gtPos + 1
        continue
      }

      j++
    }

    // Ran off end of file without closing — stop
    break
  }

  return sections
}

/**
 * Return code with sections reordered: the section at `fromIndex` moves to `toIndex`.
 */
export function reorderSections(code: string, fromIndex: number, toIndex: number): string {
  const sections = extractSections(code)
  if (!sections.length || fromIndex === toIndex) return code
  if (fromIndex < 0 || fromIndex >= sections.length) return code
  if (toIndex < 0 || toIndex >= sections.length) return code

  const sources = sections.map(s => s.source)
  const [moved] = sources.splice(fromIndex, 1)
  sources.splice(toIndex, 0, moved)

  // Preserve the inter-section whitespace from between sections[0] and sections[1]
  const sep = sections.length > 1
    ? code.slice(sections[0].end, sections[1].start)
    : '\n      '

  const rangeStart = sections[0].start
  const rangeEnd = sections[sections.length - 1].end
  return code.slice(0, rangeStart) + sources.join(sep) + code.slice(rangeEnd)
}

/**
 * Return code with the section at `index` removed.
 */
export function deleteSection(code: string, index: number): string {
  const sections = extractSections(code)
  if (index < 0 || index >= sections.length) return code

  const s = sections[index]
  if (index === 0) {
    // Remove from section start to start of next section (incl. whitespace)
    const nextStart = sections[1]?.start ?? s.end
    return code.slice(0, s.start) + code.slice(nextStart)
  } else {
    // Remove from end of previous section to end of this one
    const prevEnd = sections[index - 1].end
    const removeEnd = sections[index + 1]?.start ?? s.end
    return code.slice(0, prevEnd) + code.slice(removeEnd)
  }
}

/**
 * Insert `newSectionSource` directly after the section at `afterIndex`.
 * If `afterIndex` is -1, inserts before all sections.
 */
export function insertSectionAfter(code: string, afterIndex: number, newSectionSource: string): string {
  const sections = extractSections(code)
  if (!sections.length) return code

  const sep = sections.length > 1
    ? code.slice(sections[0].end, sections[1].start)
    : '\n      '

  const idx = Math.min(Math.max(afterIndex, 0), sections.length - 1)
  const insertAfter = sections[idx]
  return code.slice(0, insertAfter.end) + sep + newSectionSource + code.slice(insertAfter.end)
}
