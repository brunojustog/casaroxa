"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Loader2, Plus, X } from "lucide-react";

/**
 * Galeria de imagens: lista de URLs com upload múltiplo, remover individual.
 * O valor é uma string multi-linha (1 URL por linha) — formato compatível
 * com o schema Zod já existente (gallery: string parsed em array).
 */
export function GalleryUploadField({
  value,
  onChange,
}: {
  value: string;
  onChange: (multilineUrls: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const urls = value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  function setUrls(next: string[]) {
    onChange(next.join("\n"));
  }

  async function handleFiles(files: FileList) {
    setError(null);
    setUploading(true);
    const newUrls: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!data.ok) {
          setError(data.error ?? "Erro ao enviar imagem.");
          break;
        }
        newUrls.push(data.url);
      }
      if (newUrls.length > 0) setUrls([...urls, ...newUrls]);
    } catch {
      setError("Falha de conexão. Tente de novo.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removeAt(index: number) {
    setUrls(urls.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {urls.map((url, i) => (
          <div key={`${url}-${i}`} className="relative">
            <div className="relative h-24 w-24 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
              <Image
                src={url}
                alt=""
                fill
                sizes="96px"
                className="object-cover"
                unoptimized
              />
            </div>
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute -right-1.5 -top-1.5 rounded-full bg-white p-1 text-slate-500 shadow ring-1 ring-slate-200 hover:bg-red-50 hover:text-red-600"
              title="Remover"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 hover:border-roxa-300 hover:bg-roxa-50 hover:text-roxa-700 disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-[10px]">Enviando…</span>
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              <span className="text-[10px]">
                {urls.length === 0 ? "Adicionar" : "Mais"}
              </span>
            </>
          )}
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          const fs = e.currentTarget.files;
          if (fs && fs.length > 0) handleFiles(fs);
        }}
      />

      {error && <p className="text-xs text-red-600">{error}</p>}

      <p className="text-[11px] text-slate-500">
        {urls.length === 0
          ? "Nenhuma foto na galeria."
          : `${urls.length} foto${urls.length === 1 ? "" : "s"} na galeria.`}
      </p>
    </div>
  );
}
