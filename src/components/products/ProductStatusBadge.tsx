import { cn } from "@/lib/utils";
import { getStatus, ITEM_STATUS_LABEL, ITEM_STATUS_CLASS } from "@/domain/status";
import type { DecimalLike } from "@/lib/decimal";

/**
 * Badge do status financeiro computado em tempo real.
 * Não consulta nada — recebe custo/preço/meta direto.
 */
export function ProductStatusBadge({
  cost,
  price,
  targetCmv,
  className,
}: {
  cost: DecimalLike;
  price: DecimalLike;
  targetCmv: DecimalLike;
  className?: string;
}) {
  const status = getStatus(cost, price, targetCmv);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        ITEM_STATUS_CLASS[status],
        className,
      )}
    >
      {ITEM_STATUS_LABEL[status]}
    </span>
  );
}
