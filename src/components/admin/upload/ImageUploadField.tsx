"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";

type Mode = "upload" | "url";

/**
 * Campo de imagem do admin com tabs Upload/URL externa.
 * O valor armazenado é sempre uma string (URL relativa ou absoluta).
 */
export function ImageUploadField({
  value,
  onChange,
  placeholder = "/menu/foto.jpg",
}: {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>(value && /^https?:\/\//.test(value) ? "url" : "upload");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Erro ao enviar imagem.");
        return;
      }
      onChange(data.url);
    } catch {
      setError("Falha de conexão. Tente de novo.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function clear() {
    onChange("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      {/* Tabs */}
      <div className="flex gap-1 rounded-md bg-slate-100 p-1 w-fit">
        <TabButton active={mode === "upload"} onClick={() => setMode("upload")}>
          <Upload className="h-3 w-3" />
          Upload
        </TabButton>
        <TabButton active={mode === "url"} onClick={() => setMode("url")}>
          <ImageIcon className="h-3 w-3" />
          URL externa
        </TabButton>
      </div>

      {mode === "upload" ? (
        <div className="space-y-2">
          {value ? (
            <div className="relative inline-block">
              <div className="relative h-32 w-32 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                <Image
                  src={value}
                  alt="Pré-visualização"
                  fill
                  sizes="128px"
                  className="object-cover"
                  unoptimized
                />
              </div>
              <button
                type="button"
                onClick={clear}
                className="absolute -right-2 -top-2 rounded-full bg-white p-1 text-slate-500 shadow ring-1 ring-slate-200 hover:bg-red-50 hover:text-red-600"
                title="Remover"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex h-32 w-32 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 hover:border-roxa-300 hover:bg-roxa-50 hover:text-roxa-700 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-xs">Enviando…</span>
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5" />
                  <span className="text-xs">Escolher foto</span>
                </>
              )}
            </button>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              if (f) handleFile(f);
            }}
          />

          {value && !uploading && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-xs font-medium text-roxa-700 hover:underline"
            >
              Trocar foto
            </button>
          )}

          {value && (
            <p className="text-[11px] text-slate-400 truncate max-w-md">{value}</p>
          )}
        </div>
      ) : (
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          placeholder={placeholder || "https://..."}
        />
      )}

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "inline-flex items-center gap-1.5 rounded-sm bg-white px-2.5 py-1 text-xs font-medium text-slate-900 shadow-sm"
          : "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-700"
      }
    >
      {children}
    </button>
  );
}
