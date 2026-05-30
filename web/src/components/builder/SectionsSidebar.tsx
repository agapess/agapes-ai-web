'use client'
import { extractSections, reorderSections, deleteSection } from '@/lib/jsxSectionParser'

interface Props {
  code: string
  onSave: (updated: string) => void
}

/** Extracts a human-readable name from a section's JSX source */
function getSectionName(src: string, index: number): string {
  // Try to find the first meaningful text node (capital letter, not JSX expr)
  const m = src.match(/>\s*([A-Z][^<{}\n\r]{2,50}?)\s*</)
  if (m) return m[1].trim().slice(0, 32)
  // Fall back to tag name
  const tagM = src.match(/^<(\w+)/)
  if (tagM) return `<${tagM[1]}> section`
  return `Section ${index + 1}`
}

export default function SectionsSidebar({ code, onSave }: Props) {
  const sections = extractSections(code)
  if (sections.length === 0) return null

  return (
    <div className="mb-4 border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-1.5 bg-secondary/50 border-b border-border flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
          Sections ({sections.length})
        </span>
        <span className="text-[10px] text-muted-foreground/50">↑↓ to reorder</span>
      </div>
      {sections.map((sec, i) => (
        <div
          key={i}
          className="flex items-center gap-1 px-2 py-1.5 hover:bg-secondary/30 group border-b border-border last:border-b-0 transition-colors"
        >
          <span className="text-[10px] text-zinc-500 w-4 shrink-0 select-none">{i + 1}</span>
          <span className="text-[10px] text-muted-foreground flex-1 truncate" title={getSectionName(sec.source, i)}>
            {getSectionName(sec.source, i)}
          </span>

          {/* Move up */}
          <button
            onClick={() => onSave(reorderSections(code, i, i - 1))}
            disabled={i === 0}
            className="text-muted-foreground hover:text-foreground disabled:opacity-20 text-xs w-5 text-center transition-colors"
            title="Move up"
          >↑</button>

          {/* Move down */}
          <button
            onClick={() => onSave(reorderSections(code, i, i + 1))}
            disabled={i === sections.length - 1}
            className="text-muted-foreground hover:text-foreground disabled:opacity-20 text-xs w-5 text-center transition-colors"
            title="Move down"
          >↓</button>

          {/* Delete */}
          <button
            onClick={() => {
              if (confirm(`Delete "${getSectionName(sec.source, i)}"?`)) {
                onSave(deleteSection(code, i))
              }
            }}
            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs w-5 text-center transition-all"
            title="Delete section"
          >×</button>
        </div>
      ))}
    </div>
  )
}
