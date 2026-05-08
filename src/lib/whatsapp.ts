/**
 * Helpers para integração com WhatsApp via deeplink (wa.me).
 */

/** Remove tudo que não for dígito. Retorna null se vazio. */
export function sanitizeWhatsappNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

export function whatsappLink(
  rawNumber: string | null | undefined,
  message?: string,
): string | null {
  const number = sanitizeWhatsappNumber(rawNumber);
  if (!number) return null;
  const url = `https://wa.me/${number}`;
  if (!message) return url;
  return `${url}?text=${encodeURIComponent(message)}`;
}
