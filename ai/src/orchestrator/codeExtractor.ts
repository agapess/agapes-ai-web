// Match ANY fenced code block — language tag is optional
// This handles: ```jsx, ```javascript, ```react, ```tsx, ```, ```plaintext, etc.
const CODE_BLOCK_RE = /```[\w]*[ \t]*\n([\s\S]*?)```/g

// Fallback: extract code that looks like a React component even without code fences
const COMPONENT_RE = /(?:^|\n)((?:import\s+.*\n)*(?:(?:export\s+default\s+)?function\s+\w+|const\s+\w+\s*=\s*(?:\(\)|(?:\([^)]*\))\s*=>))[\s\S]*?(?:\n}(?:\s*;)?\s*$|\nexport\s+default\s+\w+))/gm

// Strip thinking model tags (qwen, deepseek, etc.)
const THINK_RE = /<think>[\s\S]*?<\/think>/g

const DANGEROUS_PATTERNS = [
  /\beval\s*\(/,
  /\bdocument\.write\s*\(/,
  /\bwindow\.location\s*=/,
]

export function extractCode(text: string): string | null {
  // Strip thinking tags from models like qwen/deepseek that emit <think>...</think>
  const cleaned = text.replace(THINK_RE, '').trim()

  // Try fenced code blocks first
  const matches = [...cleaned.matchAll(CODE_BLOCK_RE)]
  if (matches.length > 0) {
    // Pick the longest code block (most likely to be the full component)
    let best = ''
    for (const m of matches) {
      const code = m[1].trim()
      if (code.length > best.length) best = code
    }
    if (best.length > 0) return best
  }

  // Fallback: look for a React component pattern in the raw text
  const componentMatches = [...cleaned.matchAll(COMPONENT_RE)]
  if (componentMatches.length > 0) {
    const last = componentMatches[componentMatches.length - 1]
    const code = last[1].trim()
    if (code.length > 50) return code
  }

  return null
}

export function isDangerous(code: string): boolean {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(code))
}
