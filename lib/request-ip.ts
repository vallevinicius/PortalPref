import { isIP } from 'node:net'
import { headers } from 'next/headers'

// Quantidade de proxies confiáveis à frente da aplicação (Nginx Proxy Manager = 1).
// A infraestrutura sobrescreve X-Real-IP/X-Forwarded-For com o IP real da conexão
// antes de repassar a requisição; a aplicação nunca deve confiar em valores que
// cheguem de fora dessa cadeia (ver relatório GOVTECH360 nº 001/2026, achado 1).
const TRUSTED_PROXY_COUNT = Number(process.env.TRUSTED_PROXY_COUNT ?? 1)

function extractClientIp(getHeader: (name: string) => string | null): string | null {
  // X-Real-IP é sobrescrito pelo proxy confiável com $remote_addr.
  const realIp = getHeader('x-real-ip')?.trim()
  if (realIp && isIP(realIp)) return realIp

  // Fallback: item mais à DIREITA do X-Forwarded-For, nunca o primeiro — o primeiro
  // item é controlado pelo cliente e permitia zerar o contador de tentativas a cada requisição.
  const xff = getHeader('x-forwarded-for')
  if (xff) {
    const hops = xff.split(',').map((hop) => hop.trim()).filter(Boolean)
    const ip = hops[hops.length - TRUSTED_PROXY_COUNT]
    if (ip && isIP(ip)) return ip
  }

  return null
}

export function getClientIpFromRequest(request: Request): string | null {
  return extractClientIp((name) => request.headers.get(name))
}

export async function getClientIpFromHeaders(): Promise<string | null> {
  const headersList = await headers()
  return extractClientIp((name) => headersList.get(name))
}
