import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@prisma/client";

/**
 * Config Edge-safe usado pelo middleware.
 * NÃO importe Prisma, bcrypt ou nada Node-only aqui.
 * Os providers reais são adicionados em auth.ts.
 */
export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [], // populado em auth.ts (full config)
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        const u = user as { role?: UserRole };
        if (u.role) token.role = u.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (typeof token.id === "string") session.user.id = token.id;
      if (typeof token.role === "string") session.user.role = token.role as UserRole;
      return session;
    },
  },
};
