// proxy.ts — project ROOT (replaces deprecated middleware.ts)
// Next.js 16+ uses "proxy" convention instead of "middleware"
// Handles route protection and root redirect

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function proxy(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  const { pathname } = request.nextUrl

  // Root "/" → redirect to /login (or /dashboard if already signed in)
  if (pathname === '/') {
    return NextResponse.redirect(
      new URL(token ? '/dashboard' : '/login', request.url)
    )
  }

  // Already logged in and hitting /login → send to dashboard
  if (pathname === '/login' && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Protected routes — no session → /login
  const protectedPaths = [
    '/dashboard', '/users', '/failures',
    '/trace', '/scrubbing', '/tps', '/mis',
  ]
  const isProtected = protectedPaths.some(p => pathname.startsWith(p))

  if (isProtected && !token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/',
    '/dashboard/:path*',
    '/users/:path*',
    '/failures/:path*',
    '/trace/:path*',
    '/scrubbing/:path*',
    '/tps/:path*',
    '/mis/:path*',
    '/login',
  ],
}