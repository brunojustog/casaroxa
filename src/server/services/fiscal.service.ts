/**
 * Módulo fiscal — emissão de NFC-e (modelo 65) a partir das vendas do PDV.
 *
 * Arquitetura em camadas:
 *   emitNfceForSale()  → monta o payload da nota a partir da Sale
 *   FiscalProvider     → quem efetivamente autoriza na SEFAZ
 *     - SimuladoProvider: sem certificado — chave/QR fictícios, valida o
 *       fluxo completo (numeração, DANFE, cancelamento) sem valor fiscal.
 *     - (futuro) SefazProvider: NFeWizard-io/nfce com certificado A1 +
 *       CSC, ambientes de homologação e produção. Mesma interface.
 *
 * Segredos NUNCA ficam no banco: FISCAL_CSC, FISCAL_CERT_PATH e
 * FISCAL_CERT_PASS vêm de variáveis de ambiente (app.env no servidor).
 */
import { FiscalDocStatus, FiscalEnvironment, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BusinessError } from "@/server/auth-helpers";

type Tx = Prisma.TransactionClient;

// ---------- payload da nota ----------

export type NfceItemPayload = {
  code: string;
  description: string;
  ncm: string;
  cfop: string;
  cest: string | null;
  quantity: number;
  unit: "UN" | "KG";
  unitPrice: number;
  totalPrice: number;
};

export type NfcePayload = {
  series: number;
  number: number;
  environment: FiscalEnvironment;
  emittedAt: Date;
  cpfCnpj: string | null;
  items: NfceItemPayload[];
  payments: { method: string; amount: number }[];
  discount: number;
  total: number;
};

export type ProviderResult =
  | {
      ok: true;
      accessKey: string;
      protocol: string;
      qrCodeUrl: string;
      xml: string;
    }
  | { ok: false; rejectionCode: string | null; message: string };

export interface FiscalProvider {
  readonly name: string;
  authorize(payload: NfcePayload): Promise<ProviderResult>;
  cancel(accessKey: string, protocol: string, reason: string): Promise<ProviderResult>;
}

// ---------- provider SIMULADO ----------

/** Dígito verificador módulo 11 da chave de acesso (regra oficial). */
function accessKeyDv(key43: string): string {
  const weights = [2, 3, 4, 5, 6, 7, 8, 9];
  let sum = 0;
  for (let i = key43.length - 1, w = 0; i >= 0; i--, w++) {
    sum += Number(key43[i]) * weights[w % 8];
  }
  const mod = sum % 11;
  return String(mod === 0 || mod === 1 ? 0 : 11 - mod);
}

/** Monta uma chave de acesso estruturalmente válida (cUF 35 = SP). */
function buildAccessKey(payload: NfcePayload, cnpj: string): string {
  const d = payload.emittedAt;
  const aamm = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const key43 =
    "35" + // cUF São Paulo
    aamm +
    cnpj.padStart(14, "0") +
    "65" + // modelo NFC-e
    String(payload.series).padStart(3, "0") +
    String(payload.number).padStart(9, "0") +
    "1" + // tpEmis normal
    String(Math.floor(Math.random() * 1e8)).padStart(8, "0"); // cNF
  return key43 + accessKeyDv(key43);
}

const CNPJ_CASA_ROXA = "68194915000119";

/**
 * Sem certificado: autoriza "de mentirinha" com chave estruturalmente
 * válida. Serve pra validar numeração, DANFE, impressão e cancelamento.
 */
export const simuladoProvider: FiscalProvider = {
  name: "SIMULADO",
  async authorize(payload) {
    const accessKey = buildAccessKey(payload, CNPJ_CASA_ROXA);
    return {
      ok: true,
      accessKey,
      protocol: `SIM${Date.now()}`,
      qrCodeUrl: `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${accessKey}|2|2|1|SIMULADO`,
      xml: `<nfeSimulada chave="${accessKey}" total="${payload.total.toFixed(2)}"/>`,
    };
  },
  async cancel() {
    return { ok: true, accessKey: "", protocol: `SIMCANC${Date.now()}`, qrCodeUrl: "", xml: "" };
  },
};

/** Escolhe o provider pelo ambiente configurado. */
function providerFor(env: FiscalEnvironment): FiscalProvider {
  if (env === "SIMULADO") return simuladoProvider;
  // HOMOLOGACAO/PRODUCAO: entra quando o certificado A1 estiver instalado
  // (NFeWizard-io/nfce — ver task fiscal). Até lá, barramos com erro claro.
  throw new BusinessError(
    "Emissão real ainda não configurada — falta instalar o certificado A1. Use o ambiente SIMULADO por enquanto.",
  );
}

// ---------- montagem a partir da venda ----------

async function buildPayloadFromSale(tx: Tx, saleId: string, cpfCnpj: string | null) {
  const sale = await tx.sale.findUnique({
    where: { id: saleId },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, ncm: true, cest: true, cfop: true, portionLabel: true },
          },
          combo: { select: { id: true, name: true } },
        },
      },
      payments: true,
      fiscalDocument: true,
    },
  });
  if (!sale) throw new BusinessError("Venda não encontrada.");
  if (sale.status !== "CONCLUIDA")
    throw new BusinessError("Só é possível emitir nota de venda concluída.");
  if (sale.items.length === 0) throw new BusinessError("Venda sem itens.");
  if (
    sale.fiscalDocument &&
    sale.fiscalDocument.status !== "REJEITADA" &&
    sale.fiscalDocument.status !== "ERRO" &&
    sale.fiscalDocument.status !== "CANCELADA"
  ) {
    throw new BusinessError(
      `Esta venda já tem NFC-e (${sale.fiscalDocument.status.toLowerCase()}).`,
    );
  }

  const settings = await tx.settings.findUniqueOrThrow({ where: { id: 1 } });
  if (!settings.fiscalEnabled)
    throw new BusinessError("Emissão fiscal está desligada nas configurações.");

  const items = sale.items.map((it) => {
    const byWeight = !Number.isInteger(Number(it.quantity));
    return {
      code: it.product?.id ?? it.combo?.id ?? it.id,
      description: (it.product?.name ?? it.combo?.name ?? "Item").slice(0, 120),
      ncm: it.product?.ncm ?? settings.fiscalDefaultNcm,
      cfop: it.product?.cfop ?? settings.fiscalDefaultCfop,
      cest: it.product?.cest ?? null,
      quantity: Number(it.quantity),
      unit: byWeight ? ("KG" as const) : ("UN" as const),
      unitPrice: Number(it.unitPrice),
      totalPrice: Number(it.totalPrice),
    };
  });

  const payload: NfcePayload = {
    series: settings.fiscalSeries,
    number: settings.fiscalNextNumber,
    environment: settings.fiscalEnvironment,
    emittedAt: new Date(),
    cpfCnpj,
    items,
    payments: sale.payments.map((p) => ({ method: p.method, amount: Number(p.amount) })),
    discount: Number(sale.totalDiscount),
    total: Number(sale.totalRevenue),
  };

  return { sale, settings, payload };
}

// ---------- API do módulo ----------

/**
 * Emite (ou reemite, se rejeitada/erro) a NFC-e de uma venda concluída.
 * O número é alocado em transação; a autorização roda fora dela pra não
 * segurar lock durante a chamada externa.
 */
export async function emitNfceForSale(saleId: string, rawCpfCnpj?: string | null) {
  const cpfCnpj = rawCpfCnpj ? rawCpfCnpj.replace(/\D/g, "") : null;
  if (cpfCnpj && cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
    throw new BusinessError("CPF/CNPJ inválido — confira os dígitos.");
  }

  // 1. Monta payload + aloca número + cria/reusa o documento PENDENTE
  const { doc, payload, envName } = await prisma.$transaction(async (tx) => {
    const { sale, settings, payload } = await buildPayloadFromSale(tx, saleId, cpfCnpj);

    await tx.settings.update({
      where: { id: 1 },
      data: { fiscalNextNumber: { increment: 1 } },
    });

    const base = {
      series: payload.series,
      number: payload.number,
      environment: payload.environment,
      status: FiscalDocStatus.PENDENTE,
      cpfCnpj,
      totalAmount: payload.total.toFixed(2),
      accessKey: null,
      protocol: null,
      qrCodeUrl: null,
      xml: null,
      rejectionCode: null,
      errorMessage: null,
    };
    const doc = sale.fiscalDocument
      ? await tx.fiscalDocument.update({
          where: { id: sale.fiscalDocument.id },
          data: { ...base, attempts: { increment: 1 } },
        })
      : await tx.fiscalDocument.create({ data: { saleId, ...base, attempts: 1 } });

    return { doc, payload, envName: payload.environment };
  });

  // 2. Autoriza no provider
  let result: ProviderResult;
  try {
    result = await providerFor(envName).authorize(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha na comunicação com a SEFAZ.";
    await prisma.fiscalDocument.update({
      where: { id: doc.id },
      data: { status: "ERRO", errorMessage: message },
    });
    throw e instanceof BusinessError ? e : new BusinessError(message);
  }

  // 3. Persiste o desfecho
  if (result.ok) {
    return prisma.fiscalDocument.update({
      where: { id: doc.id },
      data: {
        status: "AUTORIZADA",
        accessKey: result.accessKey,
        protocol: result.protocol,
        qrCodeUrl: result.qrCodeUrl,
        xml: result.xml,
        authorizedAt: new Date(),
      },
    });
  }
  await prisma.fiscalDocument.update({
    where: { id: doc.id },
    data: {
      status: "REJEITADA",
      rejectionCode: result.rejectionCode,
      errorMessage: result.message,
    },
  });
  throw new BusinessError(`NFC-e rejeitada: ${result.message}`);
}

/** Cancela uma NFC-e autorizada (prazo legal: 30 min após autorização em SP). */
export async function cancelNfce(docId: string, reason: string) {
  const doc = await prisma.fiscalDocument.findUnique({ where: { id: docId } });
  if (!doc) throw new BusinessError("Nota não encontrada.");
  if (doc.status !== "AUTORIZADA") throw new BusinessError("Só nota autorizada pode ser cancelada.");
  if (reason.trim().length < 15)
    throw new BusinessError("Justificativa de cancelamento precisa de pelo menos 15 caracteres.");

  const result = await providerFor(doc.environment).cancel(
    doc.accessKey ?? "",
    doc.protocol ?? "",
    reason.trim(),
  );
  if (!result.ok) throw new BusinessError(`Cancelamento rejeitado: ${result.message}`);

  return prisma.fiscalDocument.update({
    where: { id: docId },
    data: { status: "CANCELADA", cancelledAt: new Date(), cancelReason: reason.trim() },
  });
}

/** Lista documentos fiscais pro painel /fiscal. */
export async function listFiscalDocuments(limit = 100) {
  return prisma.fiscalDocument.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { sale: { select: { number: true, occurredAt: true, customerName: true } } },
  });
}

/** Documento fiscal de uma venda (pro PDV/DANFE). */
export async function getFiscalDocument(id: string) {
  return prisma.fiscalDocument.findUnique({
    where: { id },
    include: {
      sale: {
        select: {
          number: true,
          occurredAt: true,
          closedAt: true,
          items: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              quantity: true,
              unitPrice: true,
              totalPrice: true,
              product: { select: { name: true } },
              combo: { select: { name: true } },
            },
          },
          payments: { select: { id: true, method: true, amount: true } },
        },
      },
    },
  });
}

/** Config fiscal pro painel. */
export async function getFiscalConfig() {
  const s = await prisma.settings.findUniqueOrThrow({
    where: { id: 1 },
    select: {
      fiscalEnabled: true,
      fiscalEnvironment: true,
      fiscalSeries: true,
      fiscalNextNumber: true,
      fiscalDefaultCfop: true,
      fiscalDefaultNcm: true,
      fiscalCscId: true,
    },
  });
  return {
    ...s,
    certInstalled: Boolean(process.env.FISCAL_CERT_PATH && process.env.FISCAL_CERT_PASS),
    cscConfigured: Boolean(process.env.FISCAL_CSC && s.fiscalCscId),
  };
}
