import type { ReportColumn, ReportFormat, ReportRow } from "@/server/services/report.service";

function formatCellForCsv(value: unknown, fmt: ReportFormat | undefined): string {
  if (value === null || value === undefined) return "";
  if (fmt === "money" || fmt === "number") {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return "";
    return n.toFixed(2).replace(".", ",");
  }
  if (fmt === "percent") {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return "";
    return (n * 100).toFixed(1).replace(".", ",") + "%";
  }
  if (fmt === "integer") {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? String(Math.round(n)) : "";
  }
  if (fmt === "date" || fmt === "datetime") {
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return String(value);
    return fmt === "date"
      ? d.toLocaleDateString("pt-BR")
      : d.toLocaleString("pt-BR");
  }
  return String(value);
}

function escapeCsv(s: string): string {
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes(";")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(columns: ReportColumn[], rows: ReportRow[]): string {
  const sep = ";"; // padrão BR
  const header = columns.map((c) => escapeCsv(c.label)).join(sep);
  const body = rows.map((row) =>
    columns.map((c) => escapeCsv(formatCellForCsv(row[c.key], c.format))).join(sep),
  );
  // BOM UTF-8 para Excel reconhecer acentos
  return "﻿" + [header, ...body].join("\r\n");
}
