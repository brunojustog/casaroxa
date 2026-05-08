import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { formatBRL, formatDate, formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import type {
  ReportColumn,
  ReportFormat,
  ReportRow,
} from "@/server/services/report.service";

function formatCell(value: unknown, fmt: ReportFormat | undefined): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-slate-300">—</span>;
  }
  switch (fmt) {
    case "money":
      return formatBRL(value as number);
    case "percent":
      return formatPercent(value as number);
    case "number":
      return formatNumber(value as number);
    case "integer":
      return Number.isFinite(Number(value)) ? String(Math.round(Number(value))) : "—";
    case "date":
      return formatDate(value as string);
    case "datetime":
      return formatDateTime(value as string);
    default:
      return String(value);
  }
}

export function ReportTable({
  columns,
  rows,
}: {
  columns: ReportColumn[];
  rows: ReportRow[];
}) {
  if (rows.length === 0) {
    return <EmptyState>Nenhum registro encontrado para esses filtros.</EmptyState>;
  }
  return (
    <Table>
      <THead>
        <TR>
          {columns.map((c) => (
            <TH key={c.key} className={c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}>
              {c.label}
            </TH>
          ))}
        </TR>
      </THead>
      <TBody>
        {rows.map((row, i) => (
          <TR key={i}>
            {columns.map((c) => {
              const aligned =
                c.align === "right"
                  ? "text-right tabular-nums"
                  : c.align === "center"
                    ? "text-center"
                    : "";
              return (
                <TD key={c.key} className={aligned}>
                  {formatCell(row[c.key], c.format)}
                </TD>
              );
            })}
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
