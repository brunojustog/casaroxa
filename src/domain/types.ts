/** Tipos compartilhados que não vêm direto do Prisma. */

export type Money = number | string; // serializado como string para passar Server→Client safe

export type AlertSeverity = "info" | "warning" | "danger";

export type DashboardAlert = {
  id: string;
  severity: AlertSeverity;
  title: string;
  description?: string;
  href?: string;
};

export type KpiValue = {
  label: string;
  value: string;
  hint?: string;
};
