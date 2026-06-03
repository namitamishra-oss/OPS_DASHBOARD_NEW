// middleware.ts — project ROOT mein rakhna (app/ ke bahar)
// Next.js 16+ mein "proxy" convention use hota hai
// Yeh file protected routes ko guard karta hai

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  const { pathname } = request.nextUrl

  // Agar login page pe hain aur already logged in → dashboard pe bhejo
  if (pathname === '/login' && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Protected routes — login nahi hai toh /login pe bhejo
  const protectedPaths = ['/dashboard', '/users', '/failures', '/trace', '/scrubbing', '/tps', '/mis']
  const isProtected = protectedPaths.some(p => pathname.startsWith(p))

  if (isProtected && !token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
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