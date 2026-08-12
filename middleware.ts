import { jwtVerify } from 'jose'
import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const loginUrl = new URL('/', request.url)

  if (!token) {
    return NextResponse.redirect(loginUrl)
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET))
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(loginUrl)
  }
}

export const config = {
  matcher: ['/admin/:path*'],
}
