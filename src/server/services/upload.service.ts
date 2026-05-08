/**
 * Upload de imagens do admin.
 *
 * Recebe um File, valida tipo/tamanho, redimensiona com sharp para max
 * 1200×1200 (mantendo proporção) e salva como WebP qualidade 80 em
 * /app/public/menu/uploads/{cuid}.webp.
 *
 * Em produção, o diretório vira um volume Docker (casa_roxa_uploads) que
 * persiste entre re-deploys.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { BusinessError } from "@/server/auth-helpers";

const ACCEPTED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_INPUT_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_DIMENSION = 1200;
const WEBP_QUALITY = 80;

/** Pasta absoluta onde os uploads são gravados (mesmo path em dev e prod). */
function uploadsDir(): string {
  return path.join(process.cwd(), "public", "menu", "uploads");
}

/** Caminho público (relativo) que vai pro banco de dados / browser. */
function publicPathFor(filename: string): string {
  return `/menu/uploads/${filename}`;
}

function shortId(): string {
  return randomBytes(8).toString("hex");
}

export type UploadedImage = {
  url: string;
  size: number;
  width: number;
  height: number;
};

export async function saveUploadedImage(file: File): Promise<UploadedImage> {
  if (!ACCEPTED_MIME.has(file.type)) {
    throw new BusinessError(
      "Tipo de arquivo não suportado. Use JPG, PNG, WebP ou GIF.",
    );
  }
  if (file.size === 0) {
    throw new BusinessError("Arquivo vazio.");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new BusinessError(
      `Arquivo muito grande. Limite: ${(MAX_INPUT_BYTES / 1024 / 1024).toFixed(0)} MB.`,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Processa: rotaciona conforme EXIF, redimensiona dentro de 1200x1200,
  // converte pra WebP. Resultado típico: 50-300 KB.
  let processed: Buffer;
  let metadata: sharp.OutputInfo;
  try {
    const result = await sharp(buffer)
      .rotate() // respeita orientação EXIF
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });
    processed = result.data;
    metadata = result.info;
  } catch {
    throw new BusinessError(
      "Não foi possível processar a imagem. Tente outro arquivo.",
    );
  }

  const dir = uploadsDir();
  await mkdir(dir, { recursive: true });

  const filename = `${shortId()}.webp`;
  const filePath = path.join(dir, filename);
  await writeFile(filePath, processed);

  return {
    url: publicPathFor(filename),
    size: processed.length,
    width: metadata.width,
    height: metadata.height,
  };
}
