import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from '../encryption'

const SECRET = 'a'.repeat(32)

describe('encryption', () => {
  it('round-trips a string', () => {
    const plaintext = 'sk-my-secret-api-key-12345'
    const encrypted = encrypt(plaintext, SECRET)!
    expect(decrypt(encrypted, SECRET)).toBe(plaintext)
  })

  it('produces different ciphertext each time (random IV)', () => {
    const encrypted1 = encrypt('same', SECRET)
    const encrypted2 = encrypt('same', SECRET)
    expect(encrypted1).not.toBe(encrypted2)
  })

  it('returns null for empty string', () => {
    expect(encrypt('', SECRET)).toBeNull()
  })

  it('decrypt returns null for tampered data', () => {
    const encrypted = encrypt('hello', SECRET)!
    const tampered = encrypted.slice(0, -4) + 'xxxx'
    expect(decrypt(tampered, SECRET)).toBeNull()
  })
})
