import { createHash } from 'node:crypto'

export const DEFAULT_PASSWORD = 'mudar123'
export const VERIFICATION_CODE_LENGTH = 6
export const VERIFICATION_CODE_DURATION_MS = 60 * 60 * 1000 // 1 hora

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

export function generateRandomPassword(length = 14) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('')
}

export function hashVerificationCode(code: string) {
  return createHash('sha256').update(code).digest('hex')
}

// Código numérico de 6 dígitos (ex.: "042817") que a pessoa recebe por e-mail
// e digita na tela de troca de senha, para confirmar que o e-mail é dela mesma.
export function generateVerificationCode() {
  const bytes = new Uint32Array(1)
  crypto.getRandomValues(bytes)
  const code = String(bytes[0] % 10 ** VERIFICATION_CODE_LENGTH).padStart(VERIFICATION_CODE_LENGTH, '0')
  return { code, codeHash: hashVerificationCode(code) }
}
