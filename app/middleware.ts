/**
 * middleware.ts
 * PROJECT ROOT mein rakhna — app/ ke bahar, package.json ke saath
 *
 * Kya karta hai?
 * → Har request pe check karta hai: kya user logged in hai?
 * → Agar nahi → /login pe redirect
 * → Agar haan → aage jaane do
 *
 * matcher mein sab dashboard pages listed hain.
 * /login aur /api/auth is list mein NAHI hain — woh public hain.
 */

export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/users/:path*',
    '/failures/:path*',
    '/trace/:path*',      // submission log page
    '/scrubbing/:path*',
    '/tps/:path*',
    '/mis/:path*',
    '/api/metrics/:path*',  // API routes bhi protect karo
    '/api/users/:path*',
    '/api/failures/:path*',
  ],
}