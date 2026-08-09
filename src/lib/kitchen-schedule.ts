/**
 * Motor de horários da cozinha — gera os slots de retirada/entrega disponíveis
 * a partir da configuração em Settings, e valida a escolha do cliente.
 *
 * Fuso: America/Sao_Paulo. O Brasil não tem horário de verão desde 2019, então
 * usamos o offset fixo -03:00 pra construir instantes a partir de horário local —
 * estável e sem depender de tz database em runtime.
 */

import { DIAS_SEMANA } from "./weekday";

export const SP_OFFSET = "-03:00";

export type DayKey = "DOM" | "SEG" | "TER" | "QUA" | "QUI" | "SEX" | "SAB";

export interface KitchenDayHours {
  /** "HH:mm" local (SP). */
  open: string;
  /** "HH:mm" local (SP). */
  close: string;
}

export type KitchenHours = Partial<Record<DayKey, KitchenDayHours>>;

export interface KitchenScheduleConfig {
  enabled: boolean;
  hours: KitchenHours;
  stepMinutes: number;
  weeksAhead: number;
  cutoffHours: number;
}

/** Faixa inicial padrão: sábado 07:00–14:00, domingo 07:00–13:00. */
export const DEFAULT_KITCHEN_HOURS: KitchenHours = {
  SAB: { open: "07:00", close: "14:00" },
  DOM: { open: "07:00", close: "13:00" },
};

const NOME_DIA_LONGO: Record<DayKey, string> = {
  DOM: "Domingo",
  SEG: "Segunda",
  TER: "Terça",
  QUA: "Quarta",
  QUI: "Quinta",
  SEX: "Sexta",
  SAB: "Sábado",
};

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Lê/normaliza o JSON de horários vindo das Settings, com fallback ao padrão. */
export function parseKitchenHours(raw: unknown): KitchenHours {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_KITCHEN_HOURS };
  const out: KitchenHours = {};
  for (const day of DIAS_SEMANA) {
    const v = (raw as Record<string, unknown>)[day];
    if (!v || typeof v !== "object") continue;
    const open = (v as Record<string, unknown>).open;
    const close = (v as Record<string, unknown>).close;
    if (typeof open === "string" && typeof close === "string" && HHMM.test(open) && HHMM.test(close) && open < close) {
      out[day] = { open, close };
    }
  }
  return Object.keys(out).length > 0 ? out : { ...DEFAULT_KITCHEN_HOURS };
}

/** Monta a config a partir de um objeto Settings (parcial). */
export function kitchenConfigFromSettings(settings: {
  kitchenScheduleEnabled?: boolean | null;
  kitchenHours?: unknown;
  kitchenSlotStepMinutes?: number | null;
  kitchenScheduleWeeksAhead?: number | null;
  kitchenCutoffHours?: number | null;
}): KitchenScheduleConfig {
  return {
    enabled: settings.kitchenScheduleEnabled ?? true,
    hours: parseKitchenHours(settings.kitchenHours),
    stepMinutes: clampInt(settings.kitchenSlotStepMinutes, 60, 5, 240),
    weeksAhead: clampInt(settings.kitchenScheduleWeeksAhead, 4, 1, 12),
    cutoffHours: clampInt(settings.kitchenCutoffHours, 2, 0, 168),
  };
}

function clampInt(v: number | null | undefined, def: number, min: number, max: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : def;
  return Math.min(max, Math.max(min, n));
}

export interface KitchenSlot {
  /** ISO UTC — id canônico do slot, é o que vai/volta do servidor. */
  value: string;
  startsAt: Date;
  dayKey: DayKey;
  /** "sáb, 09/08" */
  dateLabel: string;
  /** "11:00" */
  timeLabel: string;
  /** "Sábado, 09/08 · 11:00" */
  label: string;
}

export interface KitchenDaySlots {
  dayKey: DayKey;
  /** "Sábado, 09/08" */
  dateLabel: string;
  slots: KitchenSlot[];
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Data civil (Y/M/D) de "agora" no fuso de SP. */
function spCivilToday(now: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** Constrói o instante (Date) de um horário local SP numa data civil. */
export function spDateTime(y: number, m: number, d: number, hhmm: string): Date {
  return new Date(`${y}-${pad2(m)}-${pad2(d)}T${hhmm}:00${SP_OFFSET}`);
}

/**
 * Gera os dias (com slots) de funcionamento da cozinha a partir de agora,
 * respeitando o cutoff e a janela de semanas à frente.
 */
export function generateKitchenDays(
  config: KitchenScheduleConfig,
  now: Date = new Date(),
): KitchenDaySlots[] {
  if (!config.enabled) return [];
  const { y, m, d } = spCivilToday(now);
  const anchor = Date.UTC(y, m - 1, d, 12, 0, 0); // meio-dia UTC da data civil
  const cutoffMs = config.cutoffHours * 3600_000;
  const minStart = now.getTime() + cutoffMs;
  const totalDays = config.weeksAhead * 7;
  const days: KitchenDaySlots[] = [];

  for (let i = 0; i < totalDays; i++) {
    const dt = new Date(anchor + i * 86400_000);
    const Y = dt.getUTCFullYear();
    const M = dt.getUTCMonth() + 1;
    const D = dt.getUTCDate();
    const dayKey = DIAS_SEMANA[dt.getUTCDay()] as DayKey;
    const hours = config.hours[dayKey];
    if (!hours) continue;

    const startMin = hhmmToMinutes(hours.open);
    const endMin = hhmmToMinutes(hours.close);
    const slots: KitchenSlot[] = [];
    for (let mins = startMin; mins <= endMin; mins += config.stepMinutes) {
      const hhmm = `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;
      const startsAt = spDateTime(Y, M, D, hhmm);
      if (startsAt.getTime() < minStart) continue;
      const dateLabel = `${NOME_DIA_LONGO[dayKey]}, ${pad2(D)}/${pad2(M)}`;
      slots.push({
        value: startsAt.toISOString(),
        startsAt,
        dayKey,
        dateLabel,
        timeLabel: hhmm,
        label: `${dateLabel} · ${hhmm}`,
      });
    }
    if (slots.length > 0) {
      days.push({ dayKey, dateLabel: `${NOME_DIA_LONGO[dayKey]}, ${pad2(D)}/${pad2(M)}`, slots });
    }
  }
  return days;
}

/** Lista plana de todos os slots disponíveis. */
export function generateKitchenSlots(
  config: KitchenScheduleConfig,
  now: Date = new Date(),
): KitchenSlot[] {
  return generateKitchenDays(config, now).flatMap((d) => d.slots);
}

/**
 * Valida se um horário escolhido é um slot válido da cozinha (dia/faixa/passo
 * corretos e dentro do cutoff). Aceita Date ou ISO string.
 */
export function isValidKitchenSlot(
  config: KitchenScheduleConfig,
  chosen: Date | string,
  now: Date = new Date(),
): boolean {
  const target = typeof chosen === "string" ? new Date(chosen) : chosen;
  if (Number.isNaN(target.getTime())) return false;
  const iso = target.toISOString();
  return generateKitchenSlots(config, now).some((s) => s.value === iso);
}

/** Resumo pt-BR do funcionamento da cozinha (pra avisos). Ex.: "Sábado 07:00–14:00 · Domingo 07:00–13:00". */
export function kitchenHoursSummary(hours: KitchenHours): string {
  return DIAS_SEMANA.filter((d) => hours[d as DayKey])
    .map((d) => {
      const h = hours[d as DayKey]!;
      return `${NOME_DIA_LONGO[d as DayKey]} ${h.open}–${h.close}`;
    })
    .join(" · ");
}
