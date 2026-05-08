import { Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import type { ChatMessage } from "@prisma/client";

/**
 * Renderiza histórico de mensagens. Um row do banco = um turno (user/assistant)
 * ou um conjunto de tool_results (linha role=USER cujo content é array).
 */
export function ChatMessages({ messages }: { messages: ChatMessage[] }) {
  if (messages.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-slate-500">
        <p className="text-slate-700 font-medium mb-1">Olá, eu sou o assistente da Casa Roxa.</p>
        <p>
          Pergunte coisas como &quot;qual é o CMV do Combo Família?&quot;,
          &quot;quanto custa o frango hoje?&quot;, &quot;tem alguma compra pendente?&quot;.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((m) => (
        <MessageRow key={m.id} message={m} />
      ))}
    </div>
  );
}

function MessageRow({ message }: { message: ChatMessage }) {
  const content = message.content as unknown;

  if (message.role === "USER") {
    // content pode ser string OU array (tool_results)
    if (typeof content === "string") {
      return (
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-lg bg-roxa-700 text-white px-4 py-2 text-sm">
            <p className="whitespace-pre-wrap">{content}</p>
          </div>
        </div>
      );
    }
    // Tool results — mostra de forma compacta
    if (Array.isArray(content)) {
      return (
        <div className="flex justify-start gap-2">
          <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-1.5 text-[11px] text-slate-500 inline-flex items-center gap-1">
            <Wrench className="h-3 w-3" />
            {content.length} resultado{content.length === 1 ? "" : "s"} de ferramenta
            <details className="ml-1 cursor-pointer">
              <summary className="text-roxa-700 hover:underline">ver</summary>
              <pre className="mt-2 text-[10px] text-slate-700 max-h-48 overflow-auto bg-white border border-slate-200 rounded p-2 whitespace-pre-wrap">
                {JSON.stringify(content, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      );
    }
    return null;
  }

  if (message.role === "ASSISTANT") {
    if (!Array.isArray(content)) return null;
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] space-y-2">
          {(content as Array<{ type: string; text?: string; name?: string; input?: unknown }>).map(
            (block, i) => {
              if (block.type === "text") {
                return (
                  <div
                    key={i}
                    className="rounded-lg bg-white border border-slate-200 px-4 py-2 text-sm text-slate-800"
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{block.text}</p>
                  </div>
                );
              }
              if (block.type === "tool_use") {
                return (
                  <div
                    key={i}
                    className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 inline-flex items-center gap-1.5"
                  >
                    <Wrench className="h-3 w-3 text-slate-500" />
                    Consultando <strong>{block.name}</strong>…
                    <details className="ml-1 cursor-pointer">
                      <summary className="text-roxa-700 hover:underline">params</summary>
                      <pre className="mt-1 text-[10px] text-slate-700 max-h-32 overflow-auto whitespace-pre-wrap">
                        {JSON.stringify(block.input, null, 2)}
                      </pre>
                    </details>
                  </div>
                );
              }
              if (block.type === "thinking") {
                return null; // omitir thinking
              }
              return null;
            },
          )}
          <p className="text-[10px] text-slate-400">{formatDateTime(message.createdAt)}</p>
        </div>
      </div>
    );
  }

  return null;
}

export function ChatMessageCard({ children, role }: { children: React.ReactNode; role: "user" | "assistant" }) {
  return (
    <div className={cn("flex", role === "user" ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-2 text-sm",
          role === "user"
            ? "bg-roxa-700 text-white"
            : "bg-white border border-slate-200 text-slate-800",
        )}
      >
        {children}
      </div>
    </div>
  );
}
