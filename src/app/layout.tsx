import type { Metadata, Viewport } from "next";
import "./globals.css";

/**
 * Metadata raiz — template aplica a todas as páginas.
 * Cada layout/page pode sobrescrever via export const metadata ou
 * generateMetadata. Aqui ficam só os valores globais (title template,
 * fallback OG, theme-color).
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://casaroxa.com.br"),
  title: {
    template: "%s · Casa Roxa Assados",
    default: "Casa Roxa Assados — Sabor de domingo feito em família",
  },
  description:
    "Frangos assados, costelas e suínos com sabor de domingo em família. Faça seu pedido pelo cardápio online.",
  applicationName: "Casa Roxa",
  authors: [{ name: "Casa Roxa Assados" }],
  generator: "Next.js",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Casa Roxa Assados",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 1200,
        alt: "Casa Roxa Assados",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/logo.png"],
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#7e22ce",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
