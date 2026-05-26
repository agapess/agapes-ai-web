import { describe, it, expect } from 'vitest'
import { extractCode, isDangerous } from '../codeExtractor.js'

describe('extractCode', () => {
  it('extracts jsx code block', () => {
    const text = 'Here is the component:\n\n```jsx\nexport default function App() { return <div>hi</div> }\n```'
    expect(extractCode(text)).toBe('export default function App() { return <div>hi</div> }')
  })

  it('extracts js code block', () => {
    const text = '```js\nexport default function App() { return <div /> }\n```'
    expect(extractCode(text)).toBe('export default function App() { return <div /> }')
  })

  it('returns last code block when multiple exist', () => {
    const text = '```jsx\nfirst()\n```\nsome text\n```jsx\nsecond()\n```'
    expect(extractCode(text)).toBe('second()')
  })

  it('returns null when no code block found', () => {
    expect(extractCode('no code here')).toBeNull()
  })

  it('returns null for empty code block', () => {
    expect(extractCode('```jsx\n\n```')).toBeNull()
  })
})

describe('isDangerous', () => {
  it('flags eval()', () => {
    expect(isDangerous('eval("code")')).toBe(true)
  })

  it('flags document.write', () => {
    expect(isDangerous('document.write("xss")')).toBe(true)
  })

  it('flags innerHTML assignment', () => {
    expect(isDangerous('el.innerHTML = userInput')).toBe(true)
  })

  it('passes safe code', () => {
    expect(isDangerous('export default function App() { return <div>safe</div> }')).toBe(false)
  })
})
