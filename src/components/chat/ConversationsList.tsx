"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useTransition } from "react";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { deleteConversationAction } from "@/server/actions/chat";

export type ConversationListItem = {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
};

export function ConversationsList({
  conversations,
}: {
  conversations: ConversationListItem[];
}) {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const activeId = params?.id;
  const [pending, startTransition] = useTransition();

  function remove(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Excluir esta conversa? Não dá pra recuperar.")) return;
    startTransition(async () => {
      const res = await deleteConversationAction(id);
      if (!res.ok) window.alert(res.error);
      else if (activeId === id) router.push("/assistente");
      else router.refresh();
    });
  }

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col">
      <div className="p-3 border-b border-slate-200">
        <Button type="button" className="w-full" onClick={() => router.push("/assistente")}>
          <Plus className="h-4 w-4" />
          Nova conversa
        </Button>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">Sem conversas anteriores.</p>
        ) : (
          conversations.map((c) => {
            const active = activeId === c.id;
            return (
              <Link
                key={c.id}
                href={`/assistente/${c.id}`}
                className={cn(
                  "group flex items-start gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                  active
                    ? "bg-roxa-100 text-roxa-900"
                    : "text-slate-700 hover:bg-slate-200",
                )}
              >
                <MessageSquare className="h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{c.title}</p>
                  <p className="text-[10px] text-slate-400">
                    {formatDate(c.updatedAt)} · {c.messageCount} msgs
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => remove(c.id, e)}
                  disabled={pending}
                  className="opacity-0 group-hover:opacity-100 rounded p-1 text-slate-400 hover:text-red-600 transition-opacity"
                  title="Excluir"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </Link>
            );
          })
        )}
      </nav>
    </aside>
  );
}
