/**
 * types/next-auth.d.ts
 *
 * TypeScript mein NextAuth ki default Session aur User types extend kar rahe hain.
 * By default NextAuth mein sirf { name, email, image } hota hai.
 * Humne 'id' aur 'role' add kiya — yeh wahi fields hain jo JWT mein store ho rahe hain.
 *
 * Iske bina TypeScript error dega:
 *   "Property 'role' does not exist on type 'User'"
 */

import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id:    string
      email: string
      name:  string
      role:  string   // 'admin' | 'viewer' | 'ops'
    }
  }

  interface User {
    id:   string
    role: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id:   string
    role: string
  }
}