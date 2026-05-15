# Casa Roxa Gestão — Manual interno (site)

Site Next.js standalone com o manual de uso completo do sistema. **Independente** do app principal (roda em `localhost:3001`).

## Rodar local

```bash
cd docs-site
npm install --legacy-peer-deps
npm run dev
```

Abre em http://localhost:3001.

## Build de produção

```bash
npm run build
npm run start
```

## Estrutura

```
docs-site/
├── app/                    # rotas Next.js (App Router)
│   ├── page.tsx            # home com 3 hubs (cliente / operador / admin)
│   ├── cliente/            # 7 artigos (cliente final)
│   │   ├── page.tsx        # hub
│   │   └── [topico]/page.mdx
│   ├── operador/           # 7 artigos (perfil OPERADOR)
│   └── admin/              # 30 artigos (perfil ADMIN)
├── components/
│   ├── ArticleLayout.tsx   # wrapper de cada artigo
│   ├── mock/
│   │   ├── BrowserFrame.tsx, AdminShell.tsx, PublicSiteShell.tsx
│   │   └── screens/        # mockups animados de telas reais
│   └── ui/
│       ├── Callout.tsx     # Atenção / Dica / Por debaixo dos panos
│       └── Mermaid.tsx     # diagramas inline
├── mdx-components.tsx      # registra componentes pra ficarem disponíveis em MDX
└── tailwind.config.ts      # tema roxa
```

## Como escrever um artigo

Crie `app/[audiencia]/[slug]/page.mdx`:

```mdx
import { ArticleLayout } from "@/components/ArticleLayout"

<ArticleLayout audience="Admin" audienceHref="/admin" audienceLabel="Guia do admin" title="Título do artigo">

Texto em Markdown normal.

<Callout kind="atencao">
Aviso importante.
</Callout>

<KdsScreen />  {/* mockup animado de tela */}

<Mermaid chart={`flowchart LR
  A --> B`} />

</ArticleLayout>
```

Componentes disponíveis em MDX (sem precisar importar):
- `ArticleLayout`, `Callout`, `Mermaid`, `BrowserFrame`, `AdminShell`, `PublicSiteShell`
- Mockups de tela: `KdsScreen`, `PixCheckoutScreen`, `AiApprovalsScreen`, `CardapioScreen`, `EncomendaAdminScreen`, `CampaignFormScreen`, `PriceHistoryScreen`, `ProductionPlanScreen`, `AbandonedCartScreen`, `NpsScreen`, `PurchaseImpactScreen`

## Publicar

### Opção A — Subdomínio próprio
- Vercel: `vercel deploy --prod` (precisa de conta + login)
- Domínio: aponte CNAME de `docs.casaroxa.com.br` pro deploy

### Opção B — GitHub Pages (estático)
Adicione `output: "export"` no `next.config.mjs` e publique `out/` no GitHub Pages.

### Opção C — Junto com o app principal (Docker Swarm)
Crie service novo `casaroxa_docs` no stack e adicione label Traefik com `Host(docs.casaroxa.com.br)`.

## Por que separado do app principal?

- **Versionar texto** sem rebuild do app de produção
- **Publicar** sem afetar deploy do gestao.casaroxa.com.br
- Stack diferente (MDX) sem poluir tsconfig do app
- Pode tirar fora do repo no futuro se virar projeto autônomo
