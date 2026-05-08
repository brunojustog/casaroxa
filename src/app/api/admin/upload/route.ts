/**
 * POST /api/admin/upload
 *
 * Endpoint protegido (requireAuth) para upload de imagens do admin.
 * Recebe FormData com field "file" e retorna { ok, url, size, width, height }.
 */
import { NextResponse } from "next/server";
import { saveUploadedImage } from "@/server/services/upload.service";
import {
  BusinessError,
  UnauthorizedError,
  requireAuth,
} from "@/server/auth-helpers";

export async function POST(request: Request) {
  try {
    await requireAuth();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, error: "Não autorizado." },
        { status: 401 },
      );
    }
    throw e;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Requisição inválida (esperava multipart/form-data)." },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "Campo 'file' obrigatório." },
      { status: 400 },
    );
  }

  try {
    const uploaded = await saveUploadedImage(file);
    return NextResponse.json({ ok: true, ...uploaded });
  } catch (e) {
    if (e instanceof BusinessError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    }
    console.error("[api/admin/upload]", e);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao processar imagem." },
      { status: 500 },
    );
  }
}
