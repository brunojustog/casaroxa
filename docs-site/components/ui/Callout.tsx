/**
 * Bloco de destaque: Atenção, Dica, Por debaixo dos panos.
 */
import { AlertTriangle, Lightbulb, Wrench } from "lucide-react";

type Kind = "atencao" | "dica" | "tech";

export function Callout({
  kind,
  title,
  children,
}: {
  kind: Kind;
  title?: string;
  children: React.ReactNode;
}) {
  const style = {
    atencao: {
      border: "border-amber-300",
      bg: "bg-amber-50",
      text: "text-amber-900",
      icon: <AlertTriangle className="h-4 w-4" />,
      label: title ?? "Atenção",
    },
    dica: {
      border: "border-blue-300",
      bg: "bg-blue-50",
      text: "text-blue-900",
      icon: <Lightbulb className="h-4 w-4" />,
      label: title ?? "Dica",
    },
    tech: {
      border: "border-slate-300",
      bg: "bg-slate-100",
      text: "text-slate-700",
      icon: <Wrench className="h-4 w-4" />,
      label: title ?? "Por debaixo dos panos",
    },
  }[kind];

  return (
    <aside
      className={`my-4 rounded-md border-2 ${style.border} ${style.bg} p-4`}
    >
      <p
        className={`inline-flex items-center gap-2 text-sm font-bold ${style.text} mb-2`}
      >
        {style.icon}
        {style.label}
      </p>
      <div className={`text-sm ${style.text}`}>{children}</div>
    </aside>
  );
}
