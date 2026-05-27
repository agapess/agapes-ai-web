'use client'
import { useBuilderStore } from '@/store/builderStore'
import { useRouter } from 'next/navigation'

export default function BuilderHeader() {
  const { project, previewSize, setPreviewSize, credits } = useBuilderStore()
  const router = useRouter()

  return (
    <header className="h-12 border-b border-border flex items-center px-4 gap-4 bg-card shrink-0">
      <button
        onClick={() => router.push('/dashboard')}
        className="text-muted-foreground hover:text-foreground transition-colors text-sm"
      >
        ← Dashboard
      </button>

      <span className="text-foreground font-medium text-sm truncate flex-1">
        {project?.name ?? 'Loading…'}
      </span>

      <span className="text-xs text-muted-foreground">
        {credits} credits
      </span>

      <div className="flex items-center gap-1 bg-secondary rounded-md p-1">
        {(['desktop', 'tablet', 'mobile'] as const).map((size) => (
          <button
            key={size}
            onClick={() => setPreviewSize(size)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              previewSize === size
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {size === 'desktop' ? '🖥' : size === 'tablet' ? '📱' : '📲'}
          </button>
        ))}
      </div>

      <button className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:opacity-90 transition-opacity">
        Publish
      </button>
    </header>
  )
}
