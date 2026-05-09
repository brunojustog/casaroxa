/**
 * /robots.txt dinâmico por host:
 *   - PUBLIC_DOMAIN (cardápio): allow + sitemap
 *   - ADMIN_DOMAIN (gestão): disallow tudo
 *   - dev/localhost: disallow tudo (evita indexação acidental)
 */
import { headers } from "next/headers";

export async function GET() {
  const h = await headers();
  const host = (h.get("host") ?? "").toLowerCase().split(":")[0];
  const publicDomain = (process.env.PUBLIC_DOMAIN ?? "").toLowerCase();
  const adminDomain = (process.env.ADMIN_DOMAIN ?? "").toLowerCase();

  const isPublic =
    publicDomain &&
    (host === publicDomain || host === `www.${publicDomain}`);
  const isAdmin = adminDomain && host === adminDomain;

  let body: string;
  if (isPublic) {
    body = [
      "User-agent: *",
      "Allow: /",
      "Disallow: /api/",
      "Disallow: /checkout",
      "Disallow: /checkout/sucesso",
      "",
      `Sitemap: https://${publicDomain}/sitemap.xml`,
      "",
    ].join("\n");
  } else if (isAdmin) {
    body = ["User-agent: *", "Disallow: /", ""].join("\n");
  } else {
    // localhost / staging / desconhecido — não indexa
    body = ["User-agent: *", "Disallow: /", ""].join("\n");
  }

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
