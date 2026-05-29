'use client'
import { useBuilderStore } from '@/store/builderStore'

interface Component {
  name: string
  icon: string
  description: string
  /** Human-readable description used to prompt the AI to add this section */
  addPrompt: string
}

const COMPONENTS: Component[] = [
  {
    name: 'Hero',
    icon: '🦸',
    description: 'Full-screen hero with headline',
    addPrompt: 'Add a full-screen hero section at the top with a large gradient headline, subtitle text, and two CTA buttons (primary and secondary). Keep all existing sections below it.',
  },
  {
    name: 'Navbar',
    icon: '🔲',
    description: 'Responsive navigation bar',
    addPrompt: 'Add a responsive sticky navigation bar at the very top with a logo on the left, nav links in the center, and a CTA button on the right. Keep all existing content below it.',
  },
  {
    name: 'Features',
    icon: '✨',
    description: 'Feature grid with icons',
    addPrompt: 'Add a features section with a 3-column grid of feature cards. Each card has an emoji icon, a bold title, and a short description. Keep all existing sections.',
  },
  {
    name: 'Pricing',
    icon: '💰',
    description: '3-tier pricing cards',
    addPrompt: 'Add a pricing section with three tier cards (Starter, Pro, Enterprise). Each has a price, feature list, and CTA button. Highlight the middle Pro tier. Keep all existing sections.',
  },
  {
    name: 'Testimonials',
    icon: '💬',
    description: 'Customer testimonial cards',
    addPrompt: 'Add a testimonials section with 3 customer review cards. Each has a quote, avatar placeholder, name, and role. Keep all existing sections.',
  },
  {
    name: 'FAQ',
    icon: '❓',
    description: 'Expandable FAQ accordion',
    addPrompt: 'Add an FAQ section with 5 expandable accordion questions and answers using useState. Keep all existing sections.',
  },
  {
    name: 'CTA Banner',
    icon: '📣',
    description: 'Call-to-action banner',
    addPrompt: 'Add a call-to-action banner section with a bold headline, subtitle, and a large prominent button. Use a gradient background. Keep all existing sections.',
  },
  {
    name: 'Contact Form',
    icon: '✉️',
    description: 'Contact form with fields',
    addPrompt: 'Add a contact form section with name, email, and message fields plus a submit button. Show a success state after submit using useState. Keep all existing sections.',
  },
  {
    name: 'Footer',
    icon: '📋',
    description: 'Multi-column footer',
    addPrompt: 'Add a footer at the bottom with 4 columns (Product, Company, Resources, Legal) each with 4 links, plus a copyright line. Keep all existing sections above it.',
  },
  {
    name: 'Stats',
    icon: '📊',
    description: 'Key statistics row',
    addPrompt: 'Add a statistics section with 4 large number stats displayed in a horizontal row (e.g. users, revenue, countries, uptime). Keep all existing sections.',
  },
  {
    name: 'Team',
    icon: '👥',
    description: 'Team member cards',
    addPrompt: 'Add a team section with 4 member cards. Each has a colored avatar placeholder, name, role, and a short bio. Keep all existing sections.',
  },
  {
    name: 'Gallery',
    icon: '🖼',
    description: 'Image/card gallery grid',
    addPrompt: 'Add a gallery section with a masonry-style grid of 6 cards using colored gradient placeholders (no actual images). Keep all existing sections.',
  },
]

export default function ComponentLibrary() {
  const { previewCode } = useBuilderStore()
  const hasCode = typeof previewCode === 'string' && previewCode.trim().length > 50

  function addSection(component: Component) {
    const prompt = hasCode
      ? component.addPrompt
      : component.addPrompt.replace('Keep all existing sections', 'Build a standalone page with this section')

    window.dispatchEvent(new CustomEvent('quick-edit', { detail: { prompt } }))
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground mb-2 px-1">
        Click any section to ask AI to add it to your page.
      </p>
      {COMPONENTS.map(comp => (
        <button
          key={comp.name}
          onClick={() => addSection(comp)}
          className="flex items-center gap-2.5 px-2 py-2 rounded hover:bg-secondary text-left group transition-colors"
        >
          <span className="text-base shrink-0">{comp.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-foreground">{comp.name}</div>
            <div className="text-xs text-muted-foreground truncate">{comp.description}</div>
          </div>
          <span className="opacity-0 group-hover:opacity-100 text-xs text-primary transition-opacity shrink-0">+ Add</span>
        </button>
      ))}
    </div>
  )
}
