import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Casa Roxa — Gestão",
  description: "Sistema de gestão da Casa Roxa Assados",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
