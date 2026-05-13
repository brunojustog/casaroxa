import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks declarados via vi.hoisted (sobrevivem ao hoisting do vi.mock)
const { prismaMock, asaasMock } = vi.hoisted(() => {
  const prismaMock: any = {
    sale: { findUnique: vi.fn() },
    raffleEntry: { findMany: vi.fn(), updateMany: vi.fn() },
    customer: { findUnique: vi.fn(), update: vi.fn() },
    onlinePayment: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    settings: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  };
  prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));

  const asaasMock = {
    isAsaasConfigured: vi.fn(() => true),
    createAsaasCustomer: vi.fn(),
    createAsaasPayment: vi.fn(),
    getAsaasPixQrCode: vi.fn(),
    updateAsaasCustomer: vi.fn(),
    mapAsaasStatus: vi.fn((s: string) => s.toUpperCase()),
  };
  return { prismaMock, asaasMock };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("./asaas.service", () => asaasMock);

vi.mock("./whatsapp.service", () => ({
  sendText: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("./raffle.service", () => ({
  confirmRaffleEntriesFromPayment: vi.fn(),
  releasePendingRaffleEntries: vi.fn(),
}));

// auth-helpers puxa next-auth (ESM incompatível em vitest node env) — mock só o BusinessError
vi.mock("@/server/auth-helpers", () => {
  class BusinessError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "BusinessError";
    }
  }
  return { BusinessError };
});

// IMPORTA O SERVICE DEPOIS DOS MOCKS
import {
  initiateOnlinePayment,
  NeedCpfError,
} from "./payment.service";
import { BusinessError } from "@/server/auth-helpers";

beforeEach(() => {
  vi.clearAllMocks();
  asaasMock.isAsaasConfigured.mockReturnValue(true);
});

describe("initiateOnlinePayment — Sale", () => {
  it("lança BusinessError se Asaas não configurado", async () => {
    asaasMock.isAsaasConfigured.mockReturnValue(false);
    await expect(
      initiateOnlinePayment({
        kind: "sale",
        saleId: "sale1",
        billingType: "PIX",
      }),
    ).rejects.toThrow(BusinessError);
  });

  it("lança BusinessError se Sale não encontrada", async () => {
    prismaMock.sale.findUnique.mockResolvedValue(null);
    await expect(
      initiateOnlinePayment({
        kind: "sale",
        saleId: "sale1",
        billingType: "PIX",
      }),
    ).rejects.toThrow("Pedido não encontrado");
  });

  it("lança BusinessError se Sale CANCELADA", async () => {
    prismaMock.sale.findUnique.mockResolvedValue({
      id: "sale1",
      number: 1,
      status: "CANCELADA",
      totalRevenue: 50,
      couponDiscount: 0,
      customerId: "c1",
      onlinePayment: null,
    });
    await expect(
      initiateOnlinePayment({
        kind: "sale",
        saleId: "sale1",
        billingType: "PIX",
      }),
    ).rejects.toThrow(/cancelado/i);
  });

  it("lança BusinessError se Sale sem customerId", async () => {
    prismaMock.sale.findUnique.mockResolvedValue({
      id: "sale1",
      number: 1,
      status: "ABERTA",
      totalRevenue: 50,
      couponDiscount: 0,
      customerId: null,
      onlinePayment: null,
    });
    await expect(
      initiateOnlinePayment({
        kind: "sale",
        saleId: "sale1",
        billingType: "PIX",
      }),
    ).rejects.toThrow(/identifique-se/i);
  });

  it("rejeita valor abaixo do mínimo Asaas (R$ 5)", async () => {
    prismaMock.sale.findUnique.mockResolvedValue({
      id: "sale1",
      number: 1,
      status: "ABERTA",
      totalRevenue: 3,
      couponDiscount: 0,
      customerId: "c1",
      onlinePayment: null,
    });
    await expect(
      initiateOnlinePayment({
        kind: "sale",
        saleId: "sale1",
        billingType: "PIX",
      }),
    ).rejects.toThrow(/m[íi]nimo de cobran[çc]a/i);
  });

  it("aceita exatamente R$ 5,00 (mínimo)", async () => {
    prismaMock.sale.findUnique.mockResolvedValue({
      id: "sale1",
      number: 1,
      status: "ABERTA",
      totalRevenue: 5,
      couponDiscount: 0,
      customerId: "c1",
      onlinePayment: null,
    });
    prismaMock.customer.findUnique.mockResolvedValue({
      id: "c1",
      name: "Test",
      phone: "5514999999999",
      email: null,
      asaasCustomerId: "cus_existing",
      cpfCnpj: "11144477735",
    });
    asaasMock.updateAsaasCustomer.mockResolvedValue({ ok: true });
    prismaMock.settings.findUnique.mockResolvedValue({
      asaasPaymentTtlHours: 24,
    });
    asaasMock.createAsaasPayment.mockResolvedValue({
      ok: true,
      payment: {
        id: "pay_1",
        status: "PENDING",
        invoiceUrl: "https://asaas.com/i/pay_1",
      },
    });
    asaasMock.getAsaasPixQrCode.mockResolvedValue({
      ok: true,
      qr: { payload: "abc", encodedImage: "base64..." },
    });
    prismaMock.onlinePayment.create.mockResolvedValue({
      id: "op_1",
      billingType: "PIX",
      status: "PENDING",
      pixPayload: "abc",
      pixQrCodeBase64: "base64...",
      invoiceUrl: "https://asaas.com/i/pay_1",
      value: 5,
      dueDate: new Date(),
    });

    const result = await initiateOnlinePayment({
      kind: "sale",
      saleId: "sale1",
      billingType: "PIX",
    });

    expect(result.value).toBe(5);
    expect(result.billingType).toBe("PIX");
    expect(asaasMock.createAsaasPayment).toHaveBeenCalledOnce();
  });
});

describe("initiateOnlinePayment — CPF", () => {
  it("lança NeedCpfError se customer sem cpfCnpj", async () => {
    prismaMock.sale.findUnique.mockResolvedValue({
      id: "sale1",
      number: 1,
      status: "ABERTA",
      totalRevenue: 10,
      couponDiscount: 0,
      customerId: "c1",
      onlinePayment: null,
    });
    prismaMock.customer.findUnique.mockResolvedValue({
      id: "c1",
      name: "Test",
      phone: "5514999999999",
      email: null,
      asaasCustomerId: null,
      cpfCnpj: null,
    });
    await expect(
      initiateOnlinePayment({
        kind: "sale",
        saleId: "sale1",
        billingType: "PIX",
      }),
    ).rejects.toThrow(NeedCpfError);
  });

  it("lança NeedCpfError se cpf salvo é inválido (DV errado)", async () => {
    prismaMock.sale.findUnique.mockResolvedValue({
      id: "sale1",
      number: 1,
      status: "ABERTA",
      totalRevenue: 10,
      couponDiscount: 0,
      customerId: "c1",
      onlinePayment: null,
    });
    prismaMock.customer.findUnique.mockResolvedValue({
      id: "c1",
      name: "Test",
      phone: "5514999999999",
      email: null,
      asaasCustomerId: null,
      cpfCnpj: "11111111111", // sequência repetida, inválido
    });
    prismaMock.customer.update.mockResolvedValue({});
    await expect(
      initiateOnlinePayment({
        kind: "sale",
        saleId: "sale1",
        billingType: "PIX",
      }),
    ).rejects.toThrow(NeedCpfError);

    // Garante que limpou o cpfCnpj inválido
    expect(prismaMock.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { cpfCnpj: null },
      }),
    );
  });
});

describe("initiateOnlinePayment — Raffle", () => {
  it("rejeita raffle com valueCents < 500 (R$ 5 mínimo)", async () => {
    prismaMock.raffleEntry.findMany.mockResolvedValue([
      {
        id: "e1",
        number: 1,
        confirmed: false,
        raffleId: "r1",
        customerId: "c1",
        onlinePaymentId: null,
      },
    ]);

    await expect(
      initiateOnlinePayment({
        kind: "raffle",
        raffleId: "r1",
        customerId: "c1",
        entryIds: ["e1"],
        valueCents: 200, // R$ 2 — abaixo do mínimo
        description: "Rifa teste",
      }),
    ).rejects.toThrow(/m[íi]nimo de cobran[çc]a/i);
  });

  it("rejeita raffle se entry não existe", async () => {
    prismaMock.raffleEntry.findMany.mockResolvedValue([]);
    await expect(
      initiateOnlinePayment({
        kind: "raffle",
        raffleId: "r1",
        customerId: "c1",
        entryIds: ["e1"],
        valueCents: 600,
        description: "Rifa teste",
      }),
    ).rejects.toThrow(/n[uú]mero da cesta n[aã]o existe/i);
  });

  it("rejeita raffle se algum entry já confirmado", async () => {
    prismaMock.raffleEntry.findMany.mockResolvedValue([
      {
        id: "e1",
        number: 1,
        confirmed: true,
        raffleId: "r1",
        customerId: "c1",
        onlinePaymentId: null,
      },
    ]);
    await expect(
      initiateOnlinePayment({
        kind: "raffle",
        raffleId: "r1",
        customerId: "c1",
        entryIds: ["e1"],
        valueCents: 600,
        description: "Rifa teste",
      }),
    ).rejects.toThrow(/j[aá] foi confirmado/i);
  });

  it("rejeita raffle se entry de cliente diferente", async () => {
    prismaMock.raffleEntry.findMany.mockResolvedValue([
      {
        id: "e1",
        number: 1,
        confirmed: false,
        raffleId: "r1",
        customerId: "c-outro",
        onlinePaymentId: null,
      },
    ]);
    await expect(
      initiateOnlinePayment({
        kind: "raffle",
        raffleId: "r1",
        customerId: "c1",
        entryIds: ["e1"],
        valueCents: 600,
        description: "Rifa teste",
      }),
    ).rejects.toThrow(/clientes diferentes/i);
  });
});
