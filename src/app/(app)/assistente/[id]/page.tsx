import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { ChatInput } from "@/components/chat/ChatInput";
import {
  ConversationsList,
  type ConversationListItem,
} from "@/components/chat/ConversationsList";
import { ChatMessages } from "@/components/chat/ChatMessages";
import {
  getConversation,
  getMonthlyAiSpendUsd,
  listConversations,
} from "@/server/ai/chat.service";

export const dynamic = "force-dynamic";

export default async function ConversaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [conversation, conversations, monthlySpend] = await Promise.all([
    getConversation(id),
    listConversations(),
    getMonthlyAiSpendUsd(),
  ]);

  if (!conversation) notFound();

  const items: ConversationListItem[] = conversations.map((c) => ({
    id: c.id,
    title: c.title,
    updatedAt: c.updatedAt.toISOString(),
    messageCount: c._count.messages,
  }));

  return (
    <div className="-m-6 flex h-[calc(100vh-4rem)]">
      <ConversationsList conversations={items} />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-roxa-50 text-roxa-700">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-900 truncate max-w-md">
                {conversation.title}
              </h1>
              <p className="text-[11px] text-slate-500">
                Sonnet 4.6 · gasto do mês: ${monthlySpend.toFixed(2)} USD
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <ChatMessages messages={conversation.messages} />
        </main>

        <ChatInput conversationId={conversation.id} />
      </div>
    </div>
  );
}
