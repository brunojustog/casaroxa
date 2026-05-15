import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function ArticleLayout({
  audience,
  audienceHref,
  audienceLabel,
  title,
  children,
}: {
  audience: "Cliente" | "Operador" | "Admin";
  audienceHref: string;
  audienceLabel: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="max-w-3xl mx-auto">
      <Link
        href={audienceHref}
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft className="h-3 w-3" /> {audienceLabel}
      </Link>
      <p className="text-xs font-bold uppercase tracking-wider text-roxa-700 mb-1">
        {audience}
      </p>
      <h1 className="font-serif text-3xl font-bold text-roxa-900 mb-6 pb-3 border-b border-roxa-100">
        {title}
      </h1>
      <div className="prose">{children}</div>
    </article>
  );
}
