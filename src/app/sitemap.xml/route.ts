/**
 * /sitemap.xml dinâmico — só servido no PUBLIC_DOMAIN.
 * Inclui landing, /cardapio e cada produto/combo com showInMenu=true.
 */
import { headers } from "next/headers";
import { getPublicMenu } from "@/server/services/public-menu.service";

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

export async function GET() {
  const h = await headers();
  const host = (h.get("host") ?? "").toLowerCase().split(":")[0];
  const publicDomain = (process.env.PUBLIC_DOMAIN ?? "").toLowerCase();

  // Em admin/dev, retorna sitemap vazio (404 também serviria, mas vazio é mais amigável).
  const isPublic =
    publicDomain &&
    (host === publicDomain || host === `www.${publicDomain}`);

  if (!isPublic) {
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`,
      { headers: { "Content-Type": "application/xml; charset=utf-8" } },
    );
  }

  const base = `https://${publicDomain}`;
  const menu = await getPublicMenu();

  const urls: { loc: string; lastmod?: string; priority?: number }[] = [
    { loc: `${base}/`, priority: 1.0 },
    { loc: `${base}/cardapio`, priority: 0.9 },
  ];

  for (const cat of menu) {
    for (const item of cat.items) {
      const path = item.kind === "PRODUTO" ? "produto" : "combo";
      urls.push({
        loc: `${base}/cardapio/${path}/${item.id}`,
        priority: 0.7,
      });
    }
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url><loc>${escapeXml(u.loc)}</loc>${
            u.priority !== undefined ? `<priority>${u.priority}</priority>` : ""
          }</url>`,
      )
      .join("\n") +
    `\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
