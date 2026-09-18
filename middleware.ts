import { jwtVerify } from 'jose'
import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, type SessionPayload } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const isTrocarSenha = request.nextUrl.pathname === '/trocar-senha'
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const loginUrl = new URL('/', request.url)

  if (!token) {
    return NextResponse.redirect(loginUrl)
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET))
    const session = payload as unknown as SessionPayload

    if (session.mustChangePassword && !isTrocarSenha) {
      return NextResponse.redirect(new URL('/trocar-senha', request.url))
    }
    if (!session.mustChangePassword && isTrocarSenha) {
      return NextResponse.redirect(new URL('/admin', request.url))
    }

    return NextResponse.next()
  } catch {
    return NextResponse.redirect(loginUrl)
  }
}

export const config = {
  matcher: ['/admin/:path*', '/trocar-senha'],
}
