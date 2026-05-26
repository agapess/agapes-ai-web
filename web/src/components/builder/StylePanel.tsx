export default function StylePanel() {
  return (
    <aside className="w-60 border-l border-border bg-card flex flex-col shrink-0">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Style</h2>
      </div>
      <div className="flex-1 p-4">
        <p className="text-xs text-muted-foreground">
          Select an element in the preview to edit its styles.
        </p>
      </div>
    </aside>
  )
}
