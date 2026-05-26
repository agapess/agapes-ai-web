import { describe, it, expect } from 'vitest'
import { slugify } from '@/lib/utils'

describe('project utilities', () => {
  it('slugifies a project name', () => {
    expect(slugify('My Awesome Site!')).toBe('my-awesome-site')
  })

  it('slugifies with multiple special chars', () => {
    expect(slugify('  Hello World  ')).toBe('hello-world')
  })

  it('truncates at 80 chars', () => {
    const long = 'a'.repeat(100)
    expect(slugify(long).length).toBeLessThanOrEqual(80)
  })
})
