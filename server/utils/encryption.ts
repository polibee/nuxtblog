import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto'

/* AES-256-GCM encryption service (commerce doc §12.1).
   Key is loaded from COMMERCE_ENCRYPTION_KEY env (32-byte hex).
   fingerprint uses a separate HMAC key for dedup without exposing secrets. */

function getEncryptionKey(): Buffer {
  const key = process.env.COMMERCE_ENCRYPTION_KEY
  if (!key || key.length !== 64) {
    throw new Error('COMMERCE_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }
  return Buffer.from(key, 'hex')
}

function getFingerprintKey(): Buffer {
  const key = process.env.COMMERCE_FINGERPRINT_KEY
  if (!key || key.length !== 64) {
    throw new Error('COMMERCE_FINGERPRINT_KEY must be a 64-character hex string (32 bytes)')
  }
  return Buffer.from(key, 'hex')
}

export function encryptSecret(plaintext: string): {
  ciphertext: string
  nonce: string
  authTag: string
} {
  const key = getEncryptionKey()
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return {
    ciphertext: ciphertext.toString('hex'),
    nonce: nonce.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex')
  }
}

export function decryptSecret(encrypted: { ciphertext: string, nonce: string, authTag: string }): string {
  const key = getEncryptionKey()
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(encrypted.nonce, 'hex'))
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'hex'))
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'hex')),
    decipher.final()
  ]).toString('utf8')
}

export function fingerprint(plaintext: string): string {
  return createHmac('sha-256', getFingerprintKey()).update(plaintext).digest('hex')
}

export function maskSecret(secret: string): string {
  if (secret.length <= 8) return '••••'
  return secret.slice(0, 4) + '••••' + secret.slice(-4)
}
