import { PageHeader } from "@/components/layout/PageHeader";
import { AttendantClient } from "@/components/attendant/AttendantClient";
import { listWaConversations } from "@/server/ai/attendant.service";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AtendentePage() {
  const [settings, conversations, usage] = await Promise.all([
    prisma.settings.findUniqueOrThrow({
      where: { id: 1 },
      select: { aiAttendantEnabled: true, aiAttendantTestPhones: true },
    }),
    listWaConversations(),
    prisma.aiUsageLog.aggregate({
      where: {
        conversationId: { startsWith: "wa:" },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
      },
      _sum: { estimatedCostUsd: true },
      _count: true,
    }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Atendente IA — WhatsApp"
        description="Atendimento automático no WhatsApp da loja, com dados ao vivo do sistema."
      />
      <AttendantClient
        enabled={settings.aiAttendantEnabled}
        testPhones={settings.aiAttendantTestPhones ?? ""}
        webhookConfigured={Boolean(process.env.WA_WEBHOOK_TOKEN)}
        usageCount30d={usage._count}
        usageCostUsd30d={Number(usage._sum.estimatedCostUsd ?? 0)}
        conversations={conversations.map((c) => ({
          id: c.id,
          phone: c.phone,
          displayName: c.displayName,
          customerName: c.customer?.name ?? null,
          handedOff: c.handedOff,
          lastMessageAt: c.lastMessageAt.toISOString(),
          messages: c.messages
            .slice()
            .reverse()
            .map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              createdAt: m.createdAt.toISOString(),
            })),
        }))}
      />
    </div>
  );
}
