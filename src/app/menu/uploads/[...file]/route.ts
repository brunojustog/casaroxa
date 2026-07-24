/**
 * GET /menu/uploads/* — serve as imagens de upload direto do disco.
 *
 * O Next standalone só enxerga arquivos de public/ que existiam no boot do
 * container; foto recém-enviada pelo admin dava 404 até reiniciar o app.
 * Esta rota cobre o fallback: quando o estático não resolve, lemos do
 * volume em tempo real.
 */
import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

const BASE_DIR = path.join(process.cwd(), "public", "menu", "uploads");

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ file: string[] }> },
) {
  const { file } = await ctx.params;

  // Anti path-traversal: só nomes simples, sem "..", barras ou nulos.
  if (
    !file?.length ||
    file.some((seg) => !/^[\w.\-]+$/.test(seg) || seg.includes(".."))
  ) {
    return new NextResponse("Não encontrado", { status: 404 });
  }

  const filePath = path.join(BASE_DIR, ...file);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) return new NextResponse("Não encontrado", { status: 404 });

  try {
    const data = await fs.readFile(filePath);
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Não encontrado", { status: 404 });
  }
}
