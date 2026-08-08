/**
 * Dias da semana em SP (America/Sao_Paulo) — pra regras de disponibilidade
 * por dia (ex.: marmitas só aos sábados via Product.availableDays).
 */

export const DIAS_SEMANA = [
  "DOM",
  "SEG",
  "TER",
  "QUA",
  "QUI",
  "SEX",
  "SAB",
] as const;

const NOME_DIA: Record<string, string> = {
  DOM: "domingo",
  SEG: "segunda",
  TER: "terça",
  QUA: "quarta",
  QUI: "quinta",
  SEX: "sexta",
  SAB: "sábado",
};

function diaSemanaSPDe(date: Date): string {
  const sp = new Date(
    date.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
  );
  return DIAS_SEMANA[sp.getDay()];
}

export function diaSemanaSP(): string {
  return diaSemanaSPDe(new Date());
}

/** true se o produto está disponível na data dada (hoje, por padrão). */
export function disponivelNoDia(
  availableDays: string | null | undefined,
  date?: Date,
): boolean {
  if (!availableDays || !availableDays.trim()) return true;
  const dia = date ? diaSemanaSPDe(date) : diaSemanaSP();
  return availableDays.toUpperCase().includes(dia);
}

/** "SAB" → "sábado" · "SAB,DOM" → "sábado e domingo" (pra mensagens). */
export function nomeDosDias(availableDays: string): string {
  const nomes = availableDays
    .toUpperCase()
    .split(/[,;\s]+/)
    .filter((d) => NOME_DIA[d])
    .map((d) => NOME_DIA[d]);
  if (nomes.length <= 1) return nomes[0] ?? "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}
