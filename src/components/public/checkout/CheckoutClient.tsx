"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ImageOff,
  LogOut,
  Minus,
  Plus,
  ShoppingBag,
  Sparkles,
  Tag,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import Image from "next/image";
import { useCart, cartKeyOf } from "@/components/public/cart/CartProvider";
import { validateCouponAction } from "@/server/actions/coupons";
import { OtpLoginDialog } from "@/components/public/auth/OtpLoginDialog";
import { ConfirmOrderDialog } from "./ConfirmOrderDialog";
import { UpsellSuggestions } from "./UpsellSuggestions";

type SiteSettingsForCheckout = {
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  asaasEnabled: boolean;
  deliveryFeeNote: string | null;
  minimumOrderValue: number | null;
  whatsappNumber: string | null;
};

type DeliveryMode = "PICKUP" | "DELIVERY";

/** Como o cliente quer pagar:
 *   - WHATSAPP: combinar pelo WhatsApp depois (jeito atual)
 *   - PIX_ONLINE: pagar agora via Asaas com QR PIX
 *   - CARD_ONLINE: pagar agora via Asaas com cartão de crédito
 */
type PaymentMode = "WHATSAPP" | "PIX_ONLINE" | "CARD_ONLINE";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/** Recebe phone do banco (só dígitos com DDI: 5514999991234) e formata
 *  pra mostrar no campo: (14) 99999-1234. */
function formatPhoneForDisplay(raw: string): string {
  const d = raw.replace(/\D+/g, "");
  // Remove DDI 55 se tiver
  const local = d.startsWith("55") && d.length >= 12 ? d.slice(2) : d;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return local;
}

export function CheckoutClient({ settings }: { settings: SiteSettingsForCheckout }) {
  const router = useRouter();
  const { cart, count, total, hydrated, setQty, remove, clear } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const initialMode: DeliveryMode = settings.pickupEnabled
    ? "PICKUP"
    : settings.deliveryEnabled
      ? "DELIVERY"
      : "PICKUP";
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>(initialMode);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("WHATSAPP");
  const [address, setAddress] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressComplement, setAddressComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [reference, setReference] = useState("");
  const [paymentHint, setPaymentHint] = useState("");
  const [notes, setNotes] = useState("");

  // Cupom
  const [couponInput, setCouponInput] = useState("");
  const [couponApplied, setCouponApplied] = useState<{
    code: string;
    discount: number;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  // Identificação do cliente (sessão via OTP)
  const [authedCustomer, setAuthedCustomer] = useState<{
    id: string;
    name: string;
    phone: string;
  } | null>(null);
  const [otpOpen, setOtpOpen] = useState(false);
  /** Marca quando o endereço foi pré-carregado do cadastro — gatilho do
   *  banner amarelo e do aviso reforçado no modal de confirmação. */
  const [addressFromCustomer, setAddressFromCustomer] = useState(false);
  // Modal de dupla confirmação
  const [confirmOpen, setConfirmOpen] = useState(false);

  /** Carrega dados do cliente autenticado (cookie de sessão) e
   *  pré-preenche o formulário. Não roda se o cliente já começou a
   *  digitar manualmente (evita sobrescrever entrada em curso). */
  async function loadAuthedCustomer(force = false) {
    try {
      const res = await fetch("/api/public/me", { cache: "no-store" });
      const data = await res.json();
      if (!data.ok || !data.authenticated) {
        setAuthedCustomer(null);
        return;
      }
      const c = data.customer;
      setAuthedCustomer({ id: c.id, name: c.name, phone: c.phone });
      // Só pré-preenche se forçado (logo após OTP) OU se os campos
      // estiverem vazios (visita nova sem ter mexido)
      if (force || (!customerName && !customerPhone)) {
        setCustomerName(c.name);
        setCustomerPhone(formatPhoneForDisplay(c.phone));
        if (c.address) setAddress(c.address);
        if (c.addressNumber) setAddressNumber(c.addressNumber);
        if (c.addressComplement) setAddressComplement(c.addressComplement);
        if (c.neighborhood) setNeighborhood(c.neighborhood);
        if (c.reference) setReference(c.reference);
        if (c.address || c.neighborhood) {
          setAddressFromCustomer(true);
          // Se cliente tem endereço cadastrado, presume delivery
          if (settings.deliveryEnabled) setDeliveryMode("DELIVERY");
        }
      }
    } catch {
      /* ignora — sessão expirada ou sem rede */
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/public/logout", { method: "POST" });
    } catch {
      /* ignora */
    }
    setAuthedCustomer(null);
    setAddressFromCustomer(false);
  }

  // Quando o cliente edita o endereço manualmente, remove o aviso amarelo
  function markAddressEdited() {
    if (addressFromCustomer) setAddressFromCustomer(false);
  }

  // Tenta carregar sessão existente ao montar
  useEffect(() => {
    loadAuthedCustomer(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist form em sessionStorage pra não perder ao trocar página
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("casaroxa.checkout.v1");
      if (raw) {
        const d = JSON.parse(raw);
        if (d.customerName) setCustomerName(d.customerName);
        if (d.customerPhone) setCustomerPhone(d.customerPhone);
        if (d.deliveryMode) setDeliveryMode(d.deliveryMode);
        if (d.address) setAddress(d.address);
        if (d.addressNumber) setAddressNumber(d.addressNumber);
        if (d.addressComplement) setAddressComplement(d.addressComplement);
        if (d.neighborhood) setNeighborhood(d.neighborhood);
        if (d.reference) setReference(d.reference);
        if (d.paymentHint) setPaymentHint(d.paymentHint);
        if (d.notes) setNotes(d.notes);
      }
    } catch {
      /* ignora */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        "casaroxa.checkout.v1",
        JSON.stringify({
          customerName,
          customerPhone,
          deliveryMode,
          address,
          addressNumber,
          addressComplement,
          neighborhood,
          reference,
          paymentHint,
          notes,
        }),
      );
    } catch {
      /* ignora */
    }
  }, [
    customerName,
    customerPhone,
    deliveryMode,
    address,
    addressNumber,
    addressComplement,
    neighborhood,
    reference,
    paymentHint,
    notes,
  ]);

  // Captura de carrinho abandonado: debounce 3s após digitar phone válido
  // (10+ dígitos) com items no carrinho. POSTa pra /api/public/abandoned-cart
  // que faz upsert idempotente por phone.
  useEffect(() => {
    if (count === 0) return;
    const digits = customerPhone.replace(/\D+/g, "");
    if (digits.length < 10) return;
    const timer = setTimeout(() => {
      fetch("/api/public/abandoned-cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerPhone: digits,
          customerName: customerName.trim() || null,
          items: cart.items.map((it) => ({
            kind: it.kind,
            id: it.id,
            name: it.name,
            price: it.price,
            quantity: it.quantity,
          })),
        }),
      }).catch(() => {
        /* fire-and-forget */
      });
    }, 3000);
    return () => clearTimeout(timer);
  }, [customerPhone, customerName, count, cart.items]);

  const minOrder = settings.minimumOrderValue ?? 0;
  const belowMinimum = minOrder > 0 && total < minOrder;

  const couponDiscount = couponApplied?.discount ?? 0;
  const finalTotal = Math.max(0, total - couponDiscount);

  // Revalida cupom quando o subtotal mudar (carrinho alterado).
  // Se o pedido cair abaixo do mínimo do cupom, ele é removido com aviso.
  useEffect(() => {
    if (!couponApplied) return;
    if (total <= 0) {
      setCouponApplied(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await validateCouponAction(couponApplied.code, total);
      if (cancelled) return;
      const data = res.ok ? res.data : undefined;
      if (!data || !data.valid) {
        setCouponApplied(null);
        setCouponError(
          data && !data.valid
            ? data.error
            : "Cupom não pôde ser mantido com o novo valor do pedido.",
        );
        return;
      }
      // Atualiza só se o desconto mudou (evita re-render desnecessário).
      if (data.discount !== couponApplied.discount) {
        setCouponApplied({ code: couponApplied.code, discount: data.discount });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [total, couponApplied]);

  async function applyCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponBusy(true);
    setCouponError(null);
    try {
      const res = await validateCouponAction(code, total);
      if (!res.ok) {
        setCouponError(res.error);
        return;
      }
      if (!res.data?.valid) {
        setCouponError(res.data?.error ?? "Cupom inválido.");
        return;
      }
      setCouponApplied({
        code: res.data.coupon.code,
        discount: res.data.discount,
      });
      setCouponInput("");
    } finally {
      setCouponBusy(false);
    }
  }

  function removeCoupon() {
    setCouponApplied(null);
    setCouponError(null);
  }

  const canSubmit = useMemo(() => {
    if (count === 0) return false;
    if (belowMinimum) return false;
    if (!customerName.trim() || !customerPhone.trim()) return false;
    if (deliveryMode === "DELIVERY") {
      if (!address.trim() || !neighborhood.trim()) return false;
    }
    return true;
  }, [
    count,
    belowMinimum,
    customerName,
    customerPhone,
    deliveryMode,
    address,
    neighborhood,
  ]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    // Abre o modal de confirmação (última conferida do endereço).
    setError(null);
    setConfirmOpen(true);
  }

  async function actuallySubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone,
          deliveryMode,
          address: deliveryMode === "DELIVERY" ? address : undefined,
          addressNumber: deliveryMode === "DELIVERY" ? addressNumber : undefined,
          addressComplement:
            deliveryMode === "DELIVERY" ? addressComplement : undefined,
          neighborhood: deliveryMode === "DELIVERY" ? neighborhood : undefined,
          reference: deliveryMode === "DELIVERY" ? reference : undefined,
          paymentHint,
          notes,
          couponCode: couponApplied?.code ?? undefined,
          items: cart.items.map((i) => ({
            id: i.id,
            kind: i.kind,
            quantity: i.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Erro ao enviar pedido.");
        setSubmitting(false);
        return;
      }
      // Guarda dados do pedido na sessionStorage pra exibir na página de sucesso
      try {
        sessionStorage.setItem(
          "casaroxa.lastOrder.v1",
          JSON.stringify({
            saleNumber: data.saleNumber,
            saleId: data.saleId,
            subtotal: data.subtotal,
            couponCode: data.couponCode,
            couponDiscount: data.couponDiscount,
            total: data.total,
            whatsappLink: data.whatsappLink,
            trackingUrl: data.trackingUrl,
          }),
        );
        sessionStorage.removeItem("casaroxa.checkout.v1");
      } catch {
        /* ignora */
      }
      // Limpa o carrinho via contexto — atualiza o estado E o localStorage.
      // (Apenas remover do localStorage não bastava: o useEffect persist do
      // CartProvider re-escreveria o cart antigo em renders subsequentes.)
      clear();
      try {
        localStorage.removeItem("casaroxa.cart.v1");
      } catch {
        /* ignora */
      }

      // Se cliente escolheu pagamento online, vai pra página de pagamento.
      if (paymentMode !== "WHATSAPP") {
        router.push(
          `/checkout/pagamento/${data.saleId}?method=${paymentMode === "PIX_ONLINE" ? "PIX" : "CREDIT_CARD"}`,
        );
        return;
      }

      router.push("/checkout/sucesso");
    } catch {
      setError("Falha de conexão. Tente novamente.");
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }

  // ---------- Render ----------

  if (!hydrated) {
    return <p className="text-sm text-slate-500">Carregando carrinho…</p>;
  }

  if (count === 0) {
    return (
      <div className="rounded-xl border border-dashed border-roxa-200 bg-white p-10 text-center">
        <ShoppingBag className="mx-auto h-10 w-10 text-roxa-300" />
        <h2 className="mt-3 font-serif text-2xl font-semibold text-roxa-900">
          Seu carrinho está vazio
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Que tal escolher algo no cardápio?
        </p>
        <Link
          href="/cardapio"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-roxa-700 px-5 py-3 text-sm font-semibold text-white hover:bg-roxa-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Ir para o cardápio
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Coluna esquerda: items + form */}
      <div className="space-y-6 lg:col-span-2">
        <section className="rounded-xl border border-roxa-100 bg-white shadow-sm">
          <header className="flex items-center justify-between border-b border-roxa-100 px-5 py-4">
            <h2 className="font-serif text-xl font-semibold text-roxa-900">
              Seu pedido
            </h2>
            <Link
              href="/cardapio"
              className="text-xs font-medium text-roxa-700 hover:underline"
            >
              + Adicionar mais
            </Link>
          </header>
          <ul className="divide-y divide-roxa-50">
            {cart.items.map((it) => {
              const key = cartKeyOf(it);
              const lineTotal = it.price * it.quantity;
              return (
                <li key={key} className="flex items-center gap-3 p-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-roxa-50">
                    {it.imageUrl ? (
                      <Image
                        src={it.imageUrl}
                        alt={it.name}
                        fill
                        sizes="64px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-roxa-300">
                        <ImageOff className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-slate-900">{it.name}</p>
                    <p className="text-xs text-slate-500">{fmt(it.price)} cada</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-md border border-roxa-200">
                    <button
                      type="button"
                      onClick={() => setQty(key, it.quantity - 1)}
                      className="p-2 text-roxa-700 hover:bg-roxa-50"
                      aria-label="Diminuir"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-[2ch] text-center text-sm font-semibold tabular-nums">
                      {it.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty(key, it.quantity + 1)}
                      className="p-2 text-roxa-700 hover:bg-roxa-50"
                      aria-label="Aumentar"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="w-20 text-right text-sm font-semibold tabular-nums text-slate-900">
                    {fmt(lineTotal)}
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(key)}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Upsells: sugestões de items complementares ao cart atual */}
        <UpsellSuggestions />

        {/* Identificação por OTP (opcional, atalho pra clientes recorrentes) */}
        {authedCustomer ? (
          <section className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-green-100 text-green-700">
                <UserCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-green-900">
                  Olá, {authedCustomer.name.split(/\s+/)[0]}! 👋
                </p>
                <p className="text-[11px] text-green-800">
                  Seus dados foram carregados do cadastro.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1 rounded-md border border-green-300 bg-white px-2.5 py-1 text-xs font-medium text-green-800 hover:bg-green-100"
            >
              <LogOut className="h-3 w-3" />
              Sair
            </button>
          </section>
        ) : (
          <section className="rounded-xl border border-roxa-100 bg-roxa-50/40 p-4 shadow-sm flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-roxa-100 text-roxa-700">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-roxa-900">
                  Já é cliente?
                </p>
                <p className="text-[11px] text-roxa-800">
                  Receba um código no WhatsApp e carregue seus dados.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOtpOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
            >
              Receber código
            </button>
          </section>
        )}

        <section className="rounded-xl border border-roxa-100 bg-white p-5 shadow-sm space-y-4">
          <h2 className="font-serif text-xl font-semibold text-roxa-900">
            Seus dados
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Nome completo" required>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.currentTarget.value)}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
                placeholder="João da Silva"
              />
            </Field>
            <Field label="Telefone (com DDD)" required>
              <input
                type="tel"
                required
                inputMode="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.currentTarget.value)}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
                placeholder="(11) 99999-9999"
              />
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-roxa-100 bg-white p-5 shadow-sm space-y-4">
          <h2 className="font-serif text-xl font-semibold text-roxa-900">
            Como você quer receber?
          </h2>
          <div className="flex flex-wrap gap-3">
            {settings.pickupEnabled && (
              <ModeButton
                label="🛍 Retirar no local"
                active={deliveryMode === "PICKUP"}
                onClick={() => setDeliveryMode("PICKUP")}
              />
            )}
            {settings.deliveryEnabled && (
              <ModeButton
                label="🛵 Delivery"
                active={deliveryMode === "DELIVERY"}
                onClick={() => setDeliveryMode("DELIVERY")}
              />
            )}
          </div>

          {deliveryMode === "DELIVERY" && (
            <div className="space-y-3">
              {settings.deliveryFeeNote && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {settings.deliveryFeeNote}
                </p>
              )}
              {addressFromCustomer && (
                <div className="flex items-start gap-2 rounded-md border-2 border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">
                      Endereço carregado do seu cadastro.
                    </p>
                    <p className="mt-0.5">
                      Está pedindo de outro lugar HOJE? Confira e edite antes de
                      finalizar.
                    </p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="Endereço (rua)" required className="md:col-span-2">
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => {
                      setAddress(e.currentTarget.value);
                      markAddressEdited();
                    }}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
                    placeholder="Rua das Flores"
                  />
                </Field>
                <Field label="Número">
                  <input
                    type="text"
                    value={addressNumber}
                    onChange={(e) => {
                      setAddressNumber(e.currentTarget.value);
                      markAddressEdited();
                    }}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
                    placeholder="123"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Bairro" required>
                  <input
                    type="text"
                    required
                    value={neighborhood}
                    onChange={(e) => {
                      setNeighborhood(e.currentTarget.value);
                      markAddressEdited();
                    }}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
                    placeholder="Centro"
                  />
                </Field>
                <Field label="Complemento">
                  <input
                    type="text"
                    value={addressComplement}
                    onChange={(e) => {
                      setAddressComplement(e.currentTarget.value);
                      markAddressEdited();
                    }}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
                    placeholder="Apto 12"
                  />
                </Field>
              </div>
              <Field label="Ponto de referência">
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => {
                    setReference(e.currentTarget.value);
                    markAddressEdited();
                  }}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
                  placeholder="Próximo à praça"
                />
              </Field>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-roxa-100 bg-white p-5 shadow-sm space-y-4">
          <h2 className="font-serif text-xl font-semibold text-roxa-900">
            Pagamento e observações
          </h2>

          {/* Pagamento online (Asaas) — só se habilitado nas configurações */}
          {settings.asaasEnabled && (
            <Field
              label="Como você quer pagar?"
              hint="Pagar online agora confirma o pedido na hora. Combinar pelo WhatsApp mantém o fluxo atual."
            >
              <div className="space-y-2">
                <PaymentOption
                  id="pix"
                  checked={paymentMode === "PIX_ONLINE"}
                  onChange={() => setPaymentMode("PIX_ONLINE")}
                  title="Pagar agora com PIX"
                  description="QR Code instantâneo. Pedido confirma na hora."
                />
                <PaymentOption
                  id="card"
                  checked={paymentMode === "CARD_ONLINE"}
                  onChange={() => setPaymentMode("CARD_ONLINE")}
                  title="Pagar agora com cartão de crédito"
                  description="Checkout seguro do Asaas. Confirmação em segundos."
                />
                <PaymentOption
                  id="whatsapp"
                  checked={paymentMode === "WHATSAPP"}
                  onChange={() => setPaymentMode("WHATSAPP")}
                  title="Combinar pelo WhatsApp depois"
                  description="Você paga na retirada ou entrega — dinheiro, PIX, cartão."
                />
              </div>
            </Field>
          )}

          {paymentMode === "WHATSAPP" && (
            <Field
              label="Forma de pagamento desejada"
              hint="Combinaremos pelo WhatsApp — informamos opções (dinheiro, PIX, cartão)."
            >
              <select
                value={paymentHint}
                onChange={(e) => setPaymentHint(e.currentTarget.value)}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
              >
                <option value="">— sem preferência —</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="PIX">PIX</option>
                <option value="Cartão de crédito">Cartão de crédito</option>
                <option value="Cartão de débito">Cartão de débito</option>
              </select>
            </Field>
          )}
          <Field label="Observações" hint="Pimenta, retirada de algum item, troco, etc.">
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
            />
          </Field>
        </section>
      </div>

      {/* Coluna direita: resumo */}
      <aside className="lg:sticky lg:top-20 lg:self-start space-y-4">
        <div className="rounded-xl border border-roxa-200 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-xl font-semibold text-roxa-900">Resumo</h2>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal</span>
              <span className="tabular-nums">{fmt(total)}</span>
            </div>
            {couponApplied && (
              <div className="flex justify-between text-green-700">
                <span className="inline-flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5" />
                  Cupom {couponApplied.code}
                </span>
                <span className="tabular-nums">−{fmt(couponDiscount)}</span>
              </div>
            )}
            {deliveryMode === "DELIVERY" && (
              <div className="flex justify-between text-slate-500">
                <span>Taxa de entrega</span>
                <span>a combinar</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
              <span>Total</span>
              <span className="tabular-nums">{fmt(finalTotal)}</span>
            </div>
          </div>

          {/* Cupom */}
          <div className="mt-4 border-t border-slate-200 pt-4">
            {couponApplied ? (
              <div className="flex items-center justify-between rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4" />
                  Cupom <strong>{couponApplied.code}</strong> aplicado
                </span>
                <button
                  type="button"
                  onClick={removeCoupon}
                  className="rounded-md p-1 hover:bg-green-100"
                  aria-label="Remover cupom"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Tem um cupom?
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.currentTarget.value.toUpperCase());
                      if (couponError) setCouponError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyCoupon();
                      }
                    }}
                    placeholder="DIGITE O CÓDIGO"
                    className="h-10 flex-1 rounded-md border border-slate-300 bg-white px-3 font-mono text-sm uppercase tracking-wide focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
                  />
                  <button
                    type="button"
                    onClick={applyCoupon}
                    disabled={couponBusy || !couponInput.trim() || total <= 0}
                    className="rounded-md border border-roxa-300 bg-white px-3 text-sm font-medium text-roxa-700 hover:bg-roxa-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {couponBusy ? "…" : "Aplicar"}
                  </button>
                </div>
                {couponError && (
                  <p className="text-xs text-red-600">{couponError}</p>
                )}
              </div>
            )}
          </div>

          {belowMinimum && (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Pedido mínimo é {fmt(minOrder)}. Faltam{" "}
              <strong>{fmt(minOrder - total)}</strong>.
            </p>
          )}

          {error && (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Enviando…" : "Confirmar pedido"}
          </button>

          <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500">
            Após confirmar, você será redirecionado pro WhatsApp com o pedido pronto
            pra enviar à Casa Roxa.
          </p>
        </div>

        <Link
          href="/cardapio"
          className="block text-center text-sm text-slate-500 hover:text-roxa-700"
        >
          ← Voltar ao cardápio
        </Link>
      </aside>

      <OtpLoginDialog
        open={otpOpen}
        onClose={() => setOtpOpen(false)}
        onSuccess={() => {
          setOtpOpen(false);
          loadAuthedCustomer(true);
        }}
      />

      <ConfirmOrderDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={actuallySubmit}
        onEditAddress={() => {
          setConfirmOpen(false);
          // Foca o campo de endereço — usa um pequeno delay pra esperar o modal fechar
          setTimeout(() => {
            const el = document.querySelector<HTMLInputElement>(
              'input[placeholder="Rua das Flores"]',
            );
            el?.focus();
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 100);
        }}
        submitting={submitting}
        items={cart.items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          totalPrice: i.price * i.quantity,
        }))}
        subtotal={total}
        couponCode={couponApplied?.code ?? null}
        couponDiscount={couponDiscount}
        total={finalTotal}
        deliveryMode={deliveryMode}
        address={address}
        addressNumber={addressNumber}
        addressComplement={addressComplement}
        neighborhood={neighborhood}
        reference={reference}
        customerName={customerName}
        customerPhone={customerPhone}
        addressFromCustomer={addressFromCustomer}
      />
    </form>
  );
}

function Field({
  label,
  required,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <label className="text-xs font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

function ModeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-md border-2 border-roxa-700 bg-roxa-50 px-5 py-3 text-sm font-semibold text-roxa-800"
          : "rounded-md border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 hover:border-roxa-300"
      }
    >
      {label}
    </button>
  );
}

function PaymentOption({
  id,
  checked,
  onChange,
  title,
  description,
}: {
  id: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  description: string;
}) {
  return (
    <label
      htmlFor={`pay-${id}`}
      className={
        checked
          ? "flex cursor-pointer items-start gap-3 rounded-md border-2 border-roxa-500 bg-roxa-50/50 p-3"
          : "flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 bg-white p-3 hover:border-roxa-200"
      }
    >
      <input
        type="radio"
        id={`pay-${id}`}
        name="paymentMode"
        checked={checked}
        onChange={onChange}
        className="mt-1 h-4 w-4 accent-roxa-700"
      />
      <div className="flex-1">
        <p className={checked ? "text-sm font-semibold text-roxa-900" : "text-sm font-medium text-slate-800"}>
          {title}
        </p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </label>
  );
}
