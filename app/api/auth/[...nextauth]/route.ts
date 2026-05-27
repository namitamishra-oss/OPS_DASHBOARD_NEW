// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { queryOwn } from '@/lib/db-own'

const handler = NextAuth({
  providers: [
    // Phase 1: Simple email+password (apni approved list se)
    CredentialsProvider({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null

        // Sirf approved emails ko allow karo
        const result = await queryOwn(
          'SELECT * FROM dashboard_users WHERE email = $1 AND is_active = true',
          [credentials.email]
        )
        const user = result.rows[0]
        if (!user) return null

        // Last login update karo
        await queryOwn(
          'UPDATE dashboard_users SET last_login = NOW() WHERE email = $1',
          [credentials.email]
        )

        return { id: user.id, email: user.email, name: user.name, role: user.role }
      },
    }),

    // Phase 2: Google SSO — GOOGLE_CLIENT_ID env mein aane ke baad active hoga
    ...(process.env.GOOGLE_CLIENT_ID ? [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      })
    ] : []),
  ],

  callbacks: {
    async signIn({ user }) {
      // Google SSO ke case mein bhi approved list check karo
      if (!user.email) return false
      const result = await queryOwn(
        'SELECT id FROM dashboard_users WHERE email = $1 AND is_active = true',
        [user.email]
      )
      return result.rows.length > 0
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string
      }
      return session
    },

    async jwt({ token, user }) {
      if (user) token.role = (user as any).role
      return token
    },
  },

  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
})

export { handler as GET, handler as POST }