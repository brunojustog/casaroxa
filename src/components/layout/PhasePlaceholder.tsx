import { Construction } from "lucide-react";
import { PageHeader } from "./PageHeader";

export function PhasePlaceholder({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-roxa-50 text-roxa-700">
          <Construction className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">{phase}</h2>
        <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
          Esta tela será implementada na próxima fase. A Fase 1 entrega só a
          estrutura, banco com seed e autenticação. Veja o README para o roteiro
          completo.
        </p>
      </div>
    </div>
  );
}
