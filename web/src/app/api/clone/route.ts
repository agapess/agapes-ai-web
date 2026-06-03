import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/clone
 * Fetches a website URL and extracts its structure, colors, text, and layout
 * for AI-based cloning.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { url } = await req.json()
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  // Validate URL format
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`)
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
  }

  try {
    // Fetch the website HTML
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    })

    clearTimeout(timeout)

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch website (HTTP ${response.status})` },
        { status: 502 }
      )
    }

    const html = await response.text()

    // Extract useful information from the HTML
    const analysis = analyzeHtml(html, parsedUrl.toString())

    return NextResponse.json({ success: true, analysis })
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ error: 'Website took too long to respond' }, { status: 504 })
    }
    return NextResponse.json(
      { error: `Failed to fetch website: ${err instanceof Error ? err.message : 'Unknown error'}` },
      { status: 502 }
    )
  }
}

// ── HTML Analysis ─────────────────────────────────────────────────────────────

interface WebsiteAnalysis {
  url: string
  title: string
  description: string
  headings: string[]
  navLinks: string[]
  sections: SectionInfo[]
  colors: string[]
  fonts: string[]
  images: ImageInfo[]
  textContent: string
  rawHtmlSnippet: string
}

interface SectionInfo {
  tag: string
  id?: string
  className?: string
  textPreview: string
}

interface ImageInfo {
  src: string
  alt: string
}

function analyzeHtml(html: string, baseUrl: string): WebsiteAnalysis {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? decodeEntities(titleMatch[1].trim()) : ''

  // Extract meta description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i)
    || html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["']/i)
  const description = descMatch ? decodeEntities(descMatch[1].trim()) : ''

  // Extract headings (h1-h3)
  const headings: string[] = []
  const headingRegex = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi
  let hMatch
  while ((hMatch = headingRegex.exec(html)) !== null && headings.length < 15) {
    const text = stripTags(hMatch[1]).trim()
    if (text && text.length > 2 && text.length < 200) headings.push(text)
  }

  // Extract navigation links
  const navLinks: string[] = []
  const navMatch = html.match(/<nav[\s\S]*?<\/nav>/i)
  if (navMatch) {
    const linkRegex = /<a[^>]*>([\s\S]*?)<\/a>/gi
    let lMatch
    while ((lMatch = linkRegex.exec(navMatch[0])) !== null && navLinks.length < 10) {
      const text = stripTags(lMatch[1]).trim()
      if (text && text.length > 1 && text.length < 50) navLinks.push(text)
    }
  }

  // Extract sections/main content areas
  const sections: SectionInfo[] = []
  const sectionRegex = /<(section|main|article|header|footer)[^>]*(?:id=["']([^"']*)["'])?[^>]*(?:class=["']([^"']*)["'])?[^>]*>([\s\S]*?)<\/\1>/gi
  let sMatch
  while ((sMatch = sectionRegex.exec(html)) !== null && sections.length < 10) {
    const textPreview = stripTags(sMatch[4]).trim().slice(0, 150)
    if (textPreview.length > 10) {
      sections.push({
        tag: sMatch[1],
        id: sMatch[2] || undefined,
        className: sMatch[3]?.slice(0, 100) || undefined,
        textPreview,
      })
    }
  }

  // Extract colors from inline styles and CSS
  const colors: string[] = []
  const colorRegex = /#[0-9a-fA-F]{3,8}\b|rgb\([^)]+\)|hsl\([^)]+\)/g
  const styleBlocks = html.match(/<style[\s\S]*?<\/style>/gi)?.join('') ?? ''
  const inlineStyles = html.match(/style=["'][^"']*["']/gi)?.join('') ?? ''
  const colorSource = styleBlocks + inlineStyles
  let cMatch
  const colorSet = new Set<string>()
  while ((cMatch = colorRegex.exec(colorSource)) !== null && colorSet.size < 10) {
    colorSet.add(cMatch[0].toLowerCase())
  }
  colors.push(...colorSet)

  // Extract font families
  const fonts: string[] = []
  const fontRegex = /font-family\s*:\s*['"]?([^;'"}\n]+)/gi
  let fMatch
  const fontSet = new Set<string>()
  while ((fMatch = fontRegex.exec(colorSource + html)) !== null && fontSet.size < 5) {
    const font = fMatch[1].split(',')[0].trim().replace(/['"]/g, '')
    if (font && font.length > 2 && font.length < 40) fontSet.add(font)
  }
  fonts.push(...fontSet)

  // Extract images (first 8)
  const images: ImageInfo[] = []
  const imgRegex = /<img[^>]*src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?/gi
  let iMatch
  while ((iMatch = imgRegex.exec(html)) !== null && images.length < 8) {
    let src = iMatch[1]
    if (src.startsWith('/')) src = new URL(src, baseUrl).toString()
    if (src.startsWith('data:')) continue
    images.push({ src, alt: iMatch[2] || '' })
  }

  // Extract visible text content (stripped, truncated)
  const bodyMatch = html.match(/<body[\s\S]*?>([\s\S]*?)<\/body>/i)
  const bodyHtml = bodyMatch ? bodyMatch[1] : html
  // Remove script/style/svg tags first
  const cleaned = bodyHtml
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
  const textContent = stripTags(cleaned)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3000)

  // Get a snippet of the raw HTML structure (first 5000 chars of body, stripped of scripts)
  const rawHtmlSnippet = cleaned
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 5000)

  return {
    url: baseUrl,
    title,
    description,
    headings,
    navLinks,
    sections,
    colors,
    fonts,
    images,
    textContent,
    rawHtmlSnippet,
  }
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
}
