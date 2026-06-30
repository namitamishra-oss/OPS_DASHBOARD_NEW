/**
 * NEXTAUTH ROUTE — SIMPLIFIED (No DB dependency)
 * DB issue fix hone tak yeh use karo
 * Allowed emails hardcoded hain — baad mein DB se lenge
 */

import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// Allowed operators — jinhe dashboard access hai
// Baad mein yeh DB se aayega
const ALLOWED_USERS = [
  { id: "1", email: "ops@goflipo.in", name: "Ops Team", role: "admin" },
  { id: "2", email: "admin@goflipo.in", name: "Admin", role: "admin" },
  // Aur emails yahan add karo as needed
];

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Operator ID", type: "email" },
        password: { label: "Passcode", type: "password" },
      },

      async authorize(credentials) {
        console.log("=== AUTH ATTEMPT ===");
        console.log("Email:", credentials?.email);
        console.log("Password provided:", !!credentials?.password);
        console.log(
          "Env password exists:",
          !!process.env.OPS_DASHBOARD_PASSWORD,
        );

        // Step 1: Password check
        const validPassword =
          credentials.password === process.env.OPS_DASHBOARD_PASSWORD;

        if (!validPassword) {
          console.log("[Auth] Wrong password for:", credentials.email);
          return null;
        }

        // Step 2: Email allowed list check
        const user = ALLOWED_USERS.find(
          (u) => u.email === credentials.email.toLowerCase().trim(),
        );

        if (!user) {
          console.log("[Auth] Email not in allowed list:", credentials.email);
          return null;
        }

        console.log("[Auth] Login success:", user.email);
        return user;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { id: string; role: string }).role;
        token.name = user.name;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
  },

  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };