/**
 * POST /api/public/review/[token]
 *
 * Cliente submete a nota NPS. Sem auth — o token é o segredo.
 * Body: { score: 0..10, comment?: string }
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { submitReview } from "@/server/services/nps.service";
import { BusinessError } from "@/server/auth-helpers";

const schema = z.object({
  score: z.number().int().min(0).max(10),
  comment: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON inválido." },
      { status: 400 },
    );
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.errors[0]?.message ?? "Dados inválidos.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await submitReview({
      token,
      score: parsed.data.score,
      comment: parsed.data.comment,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof BusinessError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    }
    console.error("[api/public/review]", e);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado. Tente novamente." },
      { status: 500 },
    );
  }
}
