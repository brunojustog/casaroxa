import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  ReportColumn,
  ReportFormat,
  ReportRow,
} from "@/server/services/report.service";

function formatCellForPdf(value: unknown, fmt: ReportFormat | undefined): string {
  if (value === null || value === undefined) return "—";
  if (fmt === "money") {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return "—";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
  }
  if (fmt === "number") {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return "—";
    return new Intl.NumberFormat("pt-BR").format(n);
  }
  if (fmt === "integer") {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? String(Math.round(n)) : "—";
  }
  if (fmt === "percent") {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return "—";
    return new Intl.NumberFormat("pt-BR", {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(n);
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

export function rowsToPdf(opts: {
  title: string;
  description?: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  generatedAt?: Date;
}): Uint8Array {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(16);
  doc.setTextColor(40, 40, 40);
  doc.text("Casa Roxa — " + opts.title, 40, 40);

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  if (opts.description) {
    doc.text(opts.description, 40, 56, { maxWidth: pageWidth - 80 });
  }
  const stamp = (opts.generatedAt ?? new Date()).toLocaleString("pt-BR");
  doc.text(`Gerado em ${stamp}`, pageWidth - 40, 40, { align: "right" });

  // Table
  autoTable(doc, {
    startY: 75,
    head: [opts.columns.map((c) => c.label)],
    body: opts.rows.map((r) =>
      opts.columns.map((c) => formatCellForPdf(r[c.key], c.format)),
    ),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: {
      fillColor: [126, 34, 206], // roxa-700
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: opts.columns.reduce<Record<number, { halign: "left" | "right" | "center" }>>(
      (acc, c, idx) => {
        if (c.align && c.align !== "left") {
          acc[idx] = { halign: c.align };
        }
        return acc;
      },
      {},
    ),
    margin: { left: 40, right: 40 },
  });

  // jsPDF returns ArrayBuffer
  const arrayBuffer = doc.output("arraybuffer") as ArrayBuffer;
  return new Uint8Array(arrayBuffer);
}
