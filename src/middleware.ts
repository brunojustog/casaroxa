import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/server/auth.config";

// Usa apenas a config Edge-safe (sem Prisma/bcrypt) para o middleware.
const { auth } = NextAuth(authConfig);

/**
 * Rotas públicas (não exigem login).
 * Tudo o mais é protegido — usuário sem sessão é redirecionado para /login.
 */
const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth",
  "/api/public",
  "/cardapio",
  "/checkout",
  "/menu",
  "/_next",
];

const PUBLIC_EXACT = new Set([
  "/",
  "/favicon.ico",
  "/logo.png",
  "/logo.jpg",
  "/logo.webp",
  "/logo.svg",
]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  if (!isLoggedIn) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
