import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

export function encrypt(plaintext: string, secret: string): string | null {
  if (!plaintext) return null
  const key = Buffer.from(secret.padEnd(32, '0').slice(0, 32))
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decrypt(ciphertext: string, secret: string): string | null {
  try {
    const buf = Buffer.from(ciphertext, 'base64')
    const key = Buffer.from(secret.padEnd(32, '0').slice(0, 32))
    const iv = buf.subarray(0, IV_LENGTH)
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH)
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    return decipher.update(encrypted) + decipher.final('utf8')
  } catch {
    return null
  }
}

export function getEncryptionSecret(): string {
  const secret = process.env.ENCRYPTION_SECRET ?? ''
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_SECRET env var is required in production')
  }
  return secret || 'dev-secret-do-not-use-in-prod-xx'
}
