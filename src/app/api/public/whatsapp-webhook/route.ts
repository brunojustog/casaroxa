/**
 * POST /api/whatsapp/webhook?token=WA_WEBHOOK_TOKEN
 *
 * Recebe eventos da wuzapi (mensagens chegando no WhatsApp da loja) e
 * aciona o atendente IA. Parser tolerante: a wuzapi muda o formato do
 * payload entre versões, então extraímos telefone/texto de vários shapes
 * conhecidos e logamos o que não reconhecemos.
 */
import { NextResponse } from "next/server";
import { handleIncomingWaMessage } from "@/server/ai/attendant.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type AnyObj = Record<string, unknown>;

function get(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as AnyObj)[key];
  }
  return cur;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** Extrai {phone, text, displayName, isGroup, fromMe} dos formatos da wuzapi. */
function parseWuzapiPayload(body: unknown): {
  phone: string | null;
  text: string | null;
  displayName: string | null;
  isGroup: boolean;
  fromMe: boolean;
} {
  // wuzapi: { type: "Message", event: { Info: {...}, Message: {...} } }
  const event = (get(body, ["event"]) ?? body) as AnyObj;
  const info = (get(event, ["Info"]) ?? get(event, ["info"]) ?? {}) as AnyObj;

  // O WhatsApp moderno usa "@lid" (identificador anônimo) em Chat/Sender e
  // entrega o TELEFONE REAL em SenderAlt/ChatAlt ("5514...@s.whatsapp.net").
  // Preferimos sempre os campos *Alt; caímos nos clássicos quando não há LID.
  const candidates = [
    str(get(info, ["SenderAlt"])),
    str(get(info, ["ChatAlt"])),
    str(get(info, ["RemoteJid"])),
    str(get(info, ["Sender"])),
    str(get(info, ["Chat"])),
    str(get(event, ["from"])),
    str(get(body as AnyObj, ["from"])),
  ].filter((v): v is string => Boolean(v));

  const phoneJid =
    candidates.find((j) => j.includes("@s.whatsapp.net")) ?? candidates[0] ?? null;
  const chatJid = str(get(info, ["Chat"])) ?? str(get(info, ["RemoteJid"])) ?? phoneJid;

  const isGroup =
    Boolean(get(info, ["IsGroup"])) || (chatJid?.includes("@g.us") ?? false);
  const fromMe = Boolean(get(info, ["IsFromMe"]) ?? get(info, ["fromMe"]));

  // "5514996632710:33@s.whatsapp.net" → "5514996632710" (remove device :NN)
  const phone = phoneJid ? phoneJid.split("@")[0].split(":")[0] : null;

  const message = (get(event, ["Message"]) ?? get(event, ["message"]) ?? {}) as AnyObj;
  const text =
    str(get(message, ["conversation"])) ??
    str(get(message, ["extendedTextMessage", "text"])) ??
    str(get(message, ["ephemeralMessage", "message", "conversation"])) ??
    str(get(message, ["ephemeralMessage", "message", "extendedTextMessage", "text"])) ??
    str(get(event, ["text"])) ??
    str(get(body as AnyObj, ["text"])) ??
    str(get(body as AnyObj, ["body"]));

  const displayName =
    str(get(info, ["PushName"])) ?? str(get(event, ["pushName"])) ?? null;

  return { phone, text, displayName, isGroup, fromMe };
}

export async function POST(request: Request) {
  const secret = process.env.WA_WEBHOOK_TOKEN;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "webhook não configurado" }, { status: 503 });
  }
  const url = new URL(request.url);
  const token =
    url.searchParams.get("token") ?? request.headers.get("x-webhook-token");
  if (token !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true, action: "ignored_not_json" });
  }

  // Só nos interessam eventos de mensagem (a wuzapi manda vários tipos).
  const type = (get(body, ["type"]) as string | undefined)?.toLowerCase?.();
  if (type && !type.includes("message")) {
    return NextResponse.json({ ok: true, action: `ignored_type_${type}` });
  }

  const parsed = parseWuzapiPayload(body);
  if (!parsed.phone || !parsed.text) {
    console.log("[wa-webhook] payload sem phone/text:", JSON.stringify(body).slice(0, 600));
    return NextResponse.json({ ok: true, action: "ignored_unparsed" });
  }

  const result = await handleIncomingWaMessage({
    phone: parsed.phone,
    text: parsed.text,
    displayName: parsed.displayName,
    isGroup: parsed.isGroup,
    fromMe: parsed.fromMe,
  });

  // Observabilidade: cada decisão fica no log do container.
  console.log(
    `[wa-webhook] ${result.action} phone=${parsed.phone} nome="${parsed.displayName ?? ""}"`,
  );

  return NextResponse.json({ ok: true, ...result, reply: undefined });
}
