/**
 * JSX section parser — pure string-manipulation utilities.
 *
 * Extracts and reorders the top-level JSX children of the root wrapper element
 * inside `export default function App() { return (...) }`.
 *
 * Algorithm: character-level scanning with brace-depth tracking so that
 * `>` inside JSX attribute expressions (className={x > 0 ? 'a' : 'b'}) is
 * never confused with a tag close.
 */

export interface JsxSection {
  start: number   // inclusive index in code string
  end: number     // exclusive index in code string
  source: string  // raw JSX text of this section
}

// ── Low-level helpers ─────────────────────────────────────────────────────────

/**
 * Starting at `from` (the '<' of an opening tag), return the index of the
 * character AFTER the closing '>' of that opening tag.
 * Respects braces so `>` inside `{expr}` is not treated as tag-close.
 */
function openTagEnd(code: string, from: number): number {
  let i = from + 1
  let depth = 0
  while (i < code.length) {
    const ch = code[i]
    if (ch === '{') depth++
    else if (ch === '}') depth--
    else if (ch === '>' && depth === 0) return i + 1
    i++
  }
  return code.length
}

/**
 * Return true if the opening tag whose content runs [from, tagEnd) is
 * self-closing (ends with `/>` before the `>`).
 * tagEnd is the exclusive end of the opening tag (return value of openTagEnd).
 */
function isSelfClosing(code: string, tagEnd: number): boolean {
  // tagEnd points one past '>'; check the char before '>'
  return code[tagEnd - 2] === '/'
}

/**
 * Given the '<' of an opening tag at `tagStart`, scan forward and return
 * the index of the character AFTER its matching closing tag (or the tag
 * itself for self-closing elements).
 *
 * depth starts at 1 (we are already conceptually "inside" the opening tag).
 * Each nested opening tag increments depth; each closing tag decrements.
 * When depth reaches 0 we found the section boundary.
 */
function findSectionEnd(code: string, tagStart: number): number {
  const te = openTagEnd(code, tagStart)
  if (isSelfClosing(code, te)) return te   // <Tag /> — ends right here

  let depth = 1   // we've already consumed the section's own opening tag
  let i = te      // start scanning from inside the opening tag

  while (i < code.length) {
    if (code[i] !== '<') { i++; continue }

    // Skip JSX / HTML comments  <!-- ... -->
    if (code[i + 1] === '!' && code[i + 2] === '-' && code[i + 3] === '-') {
      const end = code.indexOf('-->', i)
      i = end > 0 ? end + 3 : i + 1
      continue
    }

    // Closing tag  </…>
    if (code[i + 1] === '/') {
      depth--
      if (depth === 0) {
        // This is the close matching our section's opening tag
        const closeGt = code.indexOf('>', i)
        return closeGt + 1   // index after '>'
      }
      // Nested close — skip past it
      const closeGt = code.indexOf('>', i)
      i = closeGt + 1
      continue
    }

    // Opening or self-closing tag  <Tag…>  or  <Tag… />
    if (/[A-Za-z{]/.test(code[i + 1])) {
      const te2 = openTagEnd(code, i)
      if (!isSelfClosing(code, te2)) depth++
      i = te2
      continue
    }

    i++
  }

  return code.length   // malformed — ran off end
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Extract all top-level JSX children of the root wrapper element.
 * Works by:
 *  1. Finding `return (` inside the function body
 *  2. Skipping past the root wrapper's opening tag
 *  3. Walking forward, correctly matching each child's open→close tags
 */
export function extractSections(code: string): JsxSection[] {
  // 1. Find `return (`
  const returnMatch = code.match(/\breturn\s*\(\s*/)
  if (!returnMatch || returnMatch.index == null) return []
  const afterReturn = returnMatch.index + returnMatch[0].length

  // 2. Find root wrapper's opening '<'
  const rootStart = code.indexOf('<', afterReturn)
  if (rootStart < 0) return []

  // 3. Skip past the root wrapper's opening tag
  const rootTagEnd = openTagEnd(code, rootStart)

  // 4. Walk children
  const sections: JsxSection[] = []
  let i = rootTagEnd

  while (i < code.length) {
    // Skip whitespace
    while (i < code.length && /[\s\n\r\t]/.test(code[i])) i++

    // Root wrapper's closing tag — we're done
    if (code[i] === '<' && code[i + 1] === '/') break

    // Not a JSX element (text node, expression, etc.) — skip
    if (code[i] !== '<') { i++; continue }

    // Skip comments
    if (code[i + 1] === '!' && code[i + 2] === '-' && code[i + 3] === '-') {
      const end = code.indexOf('-->', i)
      i = end > 0 ? end + 3 : i + 1
      continue
    }

    // Must be a tag starting with a letter (not </ or <!DOCTYPE etc.)
    if (!/[A-Za-z]/.test(code[i + 1])) { i++; continue }

    // Find where this section ends (matching close tag or />)
    const sectionStart = i
    const sectionEnd = findSectionEnd(code, sectionStart)

    sections.push({
      start: sectionStart,
      end: sectionEnd,
      source: code.slice(sectionStart, sectionEnd),
    })

    i = sectionEnd
  }

  return sections
}

/**
 * Return code with sections reordered: the section at `fromIndex` moves
 * to `toIndex`. All other sections stay in their original order.
 */
export function reorderSections(code: string, fromIndex: number, toIndex: number): string {
  const sections = extractSections(code)
  if (sections.length < 2) return code
  if (fromIndex < 0 || fromIndex >= sections.length) return code
  if (toIndex < 0 || toIndex >= sections.length) return code
  if (fromIndex === toIndex) return code

  // Collect the raw sources
  const sources = sections.map(s => s.source)
  const [moved] = sources.splice(fromIndex, 1)
  sources.splice(toIndex, 0, moved)

  // Preserve the inter-section whitespace from the original (use gap between
  // sections 0 and 1 as the canonical separator — avoids collapsing blank lines)
  const sep = sections.length > 1
    ? code.slice(sections[0].end, sections[1].start)
    : '\n      '

  const rangeStart = sections[0].start
  const rangeEnd   = sections[sections.length - 1].end
  return code.slice(0, rangeStart) + sources.join(sep) + code.slice(rangeEnd)
}

/**
 * Return code with the section at `index` removed (and its surrounding
 * whitespace trimmed so we don't leave blank lines).
 */
export function deleteSection(code: string, index: number): string {
  const sections = extractSections(code)
  if (index < 0 || index >= sections.length) return code

  const s = sections[index]

  if (sections.length === 1) {
    // Last section — remove just the section source, leave structure intact
    return code.slice(0, s.start) + code.slice(s.end)
  }

  if (index === 0) {
    // Remove from start of this section up to start of next section
    return code.slice(0, s.start) + code.slice(sections[1].start)
  }

  // Remove from end of previous section up to end of this section
  return code.slice(0, sections[index - 1].end) + code.slice(s.end)
}

/**
 * Insert `newSectionSource` directly after the section at `afterIndex`.
 */
export function insertSectionAfter(
  code: string,
  afterIndex: number,
  newSectionSource: string,
): string {
  const sections = extractSections(code)
  if (!sections.length) return code

  const sep = sections.length > 1
    ? code.slice(sections[0].end, sections[1].start)
    : '\n      '

  const idx = Math.min(Math.max(afterIndex, 0), sections.length - 1)
  const insertAfter = sections[idx]
  return (
    code.slice(0, insertAfter.end) +
    sep +
    newSectionSource +
    code.slice(insertAfter.end)
  )
}
