const CODE_BLOCK_RE = /```(?:jsx?|tsx?|javascript|typescript)\n([\s\S]*?)```/g

const DANGEROUS_PATTERNS = [
  /\beval\s*\(/,
  /\bdocument\.write\s*\(/,
  /\.innerHTML\s*=/,
  /\.outerHTML\s*=/,
  /\bwindow\.location\s*=/,
  /\bimport\s*\(/,
  /require\s*\(/,
]

export function extractCode(text: string): string | null {
  const matches = [...text.matchAll(CODE_BLOCK_RE)]
  if (matches.length === 0) return null

  const last = matches[matches.length - 1]
  const code = last[1].trim()
  return code.length > 0 ? code : null
}

export function isDangerous(code: string): boolean {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(code))
}
