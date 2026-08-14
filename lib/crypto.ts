import crypto from 'node:crypto'

function getKey() {
  const key = process.env.PASSWORD_ENCRYPTION_KEY
  if (!key) {
    throw new Error('PASSWORD_ENCRYPTION_KEY não está definido no .env')
  }
  return Buffer.from(key, 'hex')
}

export function encryptSecret(plaintext: string) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

export function decryptSecret(ciphertext: string) {
  const data = Buffer.from(ciphertext, 'base64')
  const iv = data.subarray(0, 12)
  const authTag = data.subarray(12, 28)
  const encrypted = data.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}
