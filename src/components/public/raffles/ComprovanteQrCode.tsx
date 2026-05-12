import QRCode from "qrcode";

/**
 * Server Component que gera o QR Code do comprovante pra validação.
 * Usa PUBLIC_DOMAIN se setado, senão fallback pro host atual.
 */
export async function ComprovanteQrCode({
  raffleId,
  paymentId,
}: {
  raffleId: string;
  paymentId: string;
}) {
  const base =
    process.env.PUBLIC_DOMAIN?.startsWith("http")
      ? process.env.PUBLIC_DOMAIN
      : process.env.PUBLIC_DOMAIN
        ? `https://${process.env.PUBLIC_DOMAIN}`
        : "https://casaroxa.com.br";
  const url = `${base}/sorteio/${raffleId}/comprovante/${paymentId}`;
  const dataUrl = await QRCode.toDataURL(url, {
    margin: 1,
    width: 220,
    color: { dark: "#4c1d95", light: "#ffffff" },
  });
  return (
    <div className="flex flex-col items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt="QR de validação"
        className="h-44 w-44 rounded-md border border-slate-200"
      />
      <p className="break-all text-[10px] text-slate-500">{url}</p>
    </div>
  );
}
