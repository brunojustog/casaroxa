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
  "/robots.txt",
  "/sitemap.xml",
]);

/**
 * Rotas que pertencem ao SITE público (cardápio).
 * Acessadas em ADMIN_DOMAIN, redirecionam para PUBLIC_DOMAIN.
 */
const SITE_PREFIXES = ["/cardapio", "/checkout", "/api/public", "/menu"];
const SITE_EXACT = new Set(["/", "/logo.png", "/logo.jpg", "/logo.webp", "/logo.svg"]);

/**
 * Rotas que pertencem ao ADMIN (login + app interno).
 * Acessadas em PUBLIC_DOMAIN, redirecionam para ADMIN_DOMAIN.
 */
const ADMIN_PREFIXES = [
  "/login",
  "/dashboard",
  "/ingredientes",
  "/produtos",
  "/fichas-tecnicas",
  "/combos",
  "/estoque",
  "/fornecedores",
  "/compras",
  "/vendas",
  "/assistente",
  "/simulador",
  "/cenarios",
  "/custos-fixos",
  "/resultado",
  "/relatorios",
  "/configuracoes",
  "/importar",
  "/api/auth",
  "/api/admin",
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

function isSitePath(pathname: string): boolean {
  if (SITE_EXACT.has(pathname)) return true;
  return SITE_PREFIXES.some((p) => pathname.startsWith(p));
}

function isAdminPath(pathname: string): boolean {
  return ADMIN_PREFIXES.some((p) => pathname.startsWith(p));
}

function getHost(req: Request): string {
  return (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
}

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname, search } = req.nextUrl;
  const host = getHost(req);

  const publicDomain = (process.env.PUBLIC_DOMAIN ?? "").toLowerCase();
  const adminDomain = (process.env.ADMIN_DOMAIN ?? "").toLowerCase();

  // ---------------- Host-based routing (apenas em produção) ----------------
  // Se PUBLIC_DOMAIN e ADMIN_DOMAIN estão configurados E o host atual bate
  // com um deles, aplicamos o redirecionamento cruzado.
  // Em dev (localhost) ou previews sem domínios configurados, comportamento
  // antigo: todas as rotas funcionam no mesmo host.
  if (publicDomain && adminDomain) {
    const isPublicHost =
      host === publicDomain || host === `www.${publicDomain}`;
    const isAdminHost = host === adminDomain;

    if (isPublicHost && isAdminPath(pathname)) {
      // Tentou acessar admin no domínio público → vai pro admin
      const url = new URL(`https://${adminDomain}${pathname}${search}`);
      return NextResponse.redirect(url, 308);
    }
    if (isAdminHost && isSitePath(pathname) && pathname !== "/") {
      // Tentou acessar cardápio no domínio admin → vai pro público
      // Exceção: "/" no admin redireciona para /login (abaixo).
      const url = new URL(`https://${publicDomain}${pathname}${search}`);
      return NextResponse.redirect(url, 308);
    }
    if (isAdminHost && pathname === "/") {
      // Raiz do admin → login (ou dashboard se logado)
      const dest = isLoggedIn ? "/dashboard" : "/login";
      return NextResponse.redirect(new URL(dest, req.nextUrl.origin));
    }
  }

  // ---------------- Auth check ----------------
  if (isPublicPath(pathname)) return NextResponse.next();

  if (!isLoggedIn) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // Defesa em profundidade: garante noindex em qualquer resposta admin,
  // independente da página ter metadata.robots configurada.
  const res = NextResponse.next();
  if (adminDomain && host === adminDomain) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return res;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
