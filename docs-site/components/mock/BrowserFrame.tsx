/**
 * Moldura de navegador pra envolver mockups de tela. Mostra a URL.
 */
export function BrowserFrame({
  url,
  children,
  caption,
}: {
  url: string;
  children: React.ReactNode;
  caption?: string;
}) {
  return (
    <figure className="my-6 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-400" />
          <span className="h-3 w-3 rounded-full bg-amber-400" />
          <span className="h-3 w-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 truncate rounded-md bg-white border border-slate-200 px-3 py-1 text-xs text-slate-600 font-mono">
          {url}
        </div>
      </div>
      <div className="bg-white">{children}</div>
      {caption && (
        <figcaption className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500 italic">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
