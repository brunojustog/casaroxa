# Deploy — Casa Roxa em Docker Swarm (infra Simplifica Online)

Stack: **Docker Swarm + Portainer + Traefik externo + Cloudflare DNS**.

A imagem da app é buildada localmente (ou via CI), publicada no GHCR (GitHub
Container Registry), e a stack Swarm consome essa imagem. **Não subimos Traefik
nesta stack** — o Traefik existente da infra já cuida de proxy + SSL via
certresolver `le`.

Hosts:
- **`casaroxa.com.br`** + `www.casaroxa.com.br` → cardápio público.
- **`gestao.casaroxa.com.br`** → admin (login + sistema).

A mesma instância da app responde aos dois domínios; o middleware do Next.js
faz roteamento por `Host` header.

---

## 1. Pré-requisitos da infra

No host Swarm:

- Docker Swarm já inicializado (`docker info | grep Swarm`).
- Traefik externo rodando, com:
  - `entrypoints.websecure` em `:443`
  - `certificatesresolvers.le` configurado (Let's Encrypt)
  - Conectado à rede `traefik-public`
- Rede overlay externa `traefik-public` já criada:
  ```bash
  docker network ls | grep traefik-public
  # Se não existir:
  docker network create --driver=overlay --attachable traefik-public
  ```

No GitHub:
- Repositório `brunojustog/casaroxa` criado.
- GHCR habilitado pra esse usuário (automático).
- Personal Access Token (classic) com escopo `write:packages` para fazer push
  da imagem no GHCR.

No Cloudflare (DNS):
- `casaroxa.com.br` → A record para o IP do host Traefik (proxy laranja
  desativado durante a primeira emissão de certificado se houver problemas).
- `www.casaroxa.com.br` → A record (ou CNAME para apex).
- `gestao.casaroxa.com.br` → A record para o mesmo IP.

Confirme propagação:
```bash
dig casaroxa.com.br +short
dig www.casaroxa.com.br +short
dig gestao.casaroxa.com.br +short
```

---

## 2. Build local da imagem

Na sua máquina (Windows/Linux) com Docker:

```bash
cd casa-roxa-gestao
docker build -t ghcr.io/brunojustog/casa-roxa-gestao:latest .
```

> A imagem é multi-stage: deps → builder (Next build + Prisma generate) →
> runner. O entrypoint roda `prisma migrate deploy` + seed antes de subir o
> Next, então o container é "self-bootstrap" no primeiro start.

---

## 3. Login no GHCR + push

Crie um token em https://github.com/settings/tokens (clássico) com escopo
`write:packages` e `read:packages`. Salve em variável de ambiente local:

```bash
export GHCR_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxx
echo "$GHCR_TOKEN" | docker login ghcr.io -u brunojustog --password-stdin
```

Depois do login:

```bash
docker push ghcr.io/brunojustog/casa-roxa-gestao:latest
```

---

## 4. Configurar variáveis no Portainer

No Portainer, ao criar a stack:

1. **Stacks → Add stack → Web editor**.
2. **Cole o conteúdo de `deploy/casa-roxa.stack.yml`**.
3. Em **Environment variables**, preencha (a partir de `.env.production.example`):

| Variável | Valor sugerido | Notas |
|---|---|---|
| `PUBLIC_DOMAIN` | `casaroxa.com.br` | sem `https://`, sem barra final |
| `ADMIN_DOMAIN` | `gestao.casaroxa.com.br` | idem |
| `POSTGRES_USER` | `casaroxa` | |
| `POSTGRES_PASSWORD` | (gerar) | `openssl rand -base64 24` |
| `POSTGRES_DB` | `casa_roxa` | |
| `AUTH_SECRET` | (gerar) | `openssl rand -base64 32` |
| `AUTH_TRUST_HOST` | `true` | obrigatório atrás de proxy |
| `NEXT_PUBLIC_APP_NAME` | `Casa Roxa — Gestão` | |
| `ANTHROPIC_API_KEY` | sua chave | de console.anthropic.com |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | |
| `AI_MONTHLY_BUDGET_USD` | `30` | |
| `SEED_ADMIN_EMAIL` | `admin@casaroxa.com.br` | |
| `SEED_ADMIN_PASSWORD` | (forte) | use senha única |
| `SEED_ADMIN_NAME` | `Administrador` | |

---

## 5. Deploy da stack

### Via Portainer (recomendado)

1. Após colar o YAML e configurar as variáveis, clique **Deploy the stack**.
2. Em **Registry credentials**, certifique-se que GHCR está autenticado
   (Configurations → Registries → adicione GHCR com seu token se ainda não
   estiver).

### Via CLI (alternativa)

```bash
# Login no GHCR no host Swarm
echo "$GHCR_TOKEN" | docker login ghcr.io -u brunojustog --password-stdin

# Deploy (assumindo que .env existe no diretório do stack)
docker stack deploy \
  -c deploy/casa-roxa.stack.yml \
  --with-registry-auth \
  casa-roxa
```

> O flag `--with-registry-auth` propaga a autenticação do GHCR para todos os
> nodes do Swarm — necessário se o GHCR é privado.

---

## 6. Verificação

```bash
# Lista os serviços
docker service ls | grep casa-roxa

# Logs em tempo real
docker service logs casa-roxa_app -f
docker service logs casa-roxa_postgres -f
```

Procure por:
- `Aguardando Postgres em postgres:5432...` → `Postgres respondeu`
- `Aplicando migrations...` → `Database migrations applied successfully`
- `Iniciando Next...` → `▲ Next.js`

Teste no navegador:
- https://casaroxa.com.br → cardápio público
- https://gestao.casaroxa.com.br → redireciona para `/login`

---

## 7. Migrations e seed

O entrypoint do container faz tudo automaticamente no boot:

1. Aguarda Postgres aceitar conexão (até 60s).
2. Roda `npx prisma migrate deploy` — aplica migrations versionadas em
   `prisma/migrations/` que ainda não foram aplicadas no banco. **Idempotente.**
3. Roda `npx tsx prisma/seed.ts` — cria/atualiza o admin via upsert.
   **Idempotente** (não cria duplicado).
4. Sobe o Next.

### Migration manual (se necessário)

Se quiser rodar antes ou separado:

```bash
docker service ps casa-roxa_app  # pega o container ID
docker exec -it <container_id> npx prisma migrate deploy
```

### Reset do banco (cuidado — apaga tudo)

```bash
# NÃO USE EM PRODUÇÃO depois que tiver dados reais.
docker exec -it <postgres_container> psql -U casaroxa -d casa_roxa -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
docker service update --force casa-roxa_app  # re-roda entrypoint
```

---

## 8. Atualizações de código

Fluxo padrão de atualização:

```bash
# Local
git pull
docker build -t ghcr.io/brunojustog/casa-roxa-gestao:latest .
docker push ghcr.io/brunojustog/casa-roxa-gestao:latest

# No host Swarm (ou Portainer → Update)
docker service update --image ghcr.io/brunojustog/casa-roxa-gestao:latest --with-registry-auth casa-roxa_app
```

Migrations novas? Já vão rodar automaticamente no entrypoint do novo container.

> A flag `update_config.order: start-first` no stack.yml faz o container novo
> subir antes do antigo descer — sem downtime quando dá certo. Se a nova
> versão crashar, `failure_action: rollback` reverte automaticamente.

---

## 9. Volume de uploads

A partir de v0.6, a stack inclui o volume `casa_roxa_casa_roxa_uploads`
(montado em `/app/public/menu/uploads`) onde ficam as fotos enviadas pelo
admin (foto principal, galeria, hero promo).

- **Persiste entre re-deploys** — atualizar a imagem da app não apaga as fotos.
- Backup recomendado junto com o Postgres:
  ```bash
  # Backup do diretório de uploads
  docker run --rm -v casa-roxa_casa_roxa_uploads:/data -v /var/backups/casa_roxa:/backup alpine tar czf /backup/uploads_$(date +%F).tar.gz -C /data .
  ```
- Restaurar:
  ```bash
  docker run --rm -v casa-roxa_casa_roxa_uploads:/data -v /var/backups/casa_roxa:/backup alpine tar xzf /backup/uploads_2026-05-08.tar.gz -C /data
  ```

> **Atenção:** ao remover o stack (`docker stack rm casa-roxa`), o volume
> permanece. Para apagar tudo: `docker volume rm casa-roxa_casa_roxa_uploads`.

---

## 10. Backup do banco

Cron diário no host Swarm (como root ou usuário com Docker):

```cron
0 3 * * * docker exec $(docker ps -qf name=casa-roxa_postgres) pg_dump -U casaroxa casa_roxa | gzip > /var/backups/casa_roxa/casa_roxa_$(date +\%F).sql.gz
0 4 * * 0 find /var/backups/casa_roxa -name "*.sql.gz" -mtime +30 -delete
```

Restauração:
```bash
gunzip < backup.sql.gz | docker exec -i $(docker ps -qf name=casa-roxa_postgres) psql -U casaroxa casa_roxa
```

---

## 11. Troubleshooting

### "no such image: ghcr.io/brunojustog/casa-roxa-gestao:latest"
- Imagem não foi pushada ainda. Build + push novamente.
- Ou GHCR é privado e Swarm não tem auth: `docker stack deploy --with-registry-auth ...`

### Certificado SSL não emite (`acme: error 400`)
- DNS ainda não propagou. Confirme com `dig`.
- Cloudflare proxy (laranja) pode estar interferindo no challenge — desabilite
  durante a primeira emissão.
- Veja logs do Traefik externo: `docker service logs traefik -f`

### App em loop de restart
- `docker service logs casa-roxa_app -f`
- Geralmente é `DATABASE_URL` errada ou Postgres não veio.
- Confirme que a rede `casa-roxa-internal` foi criada e que ambos serviços
  estão nela.

### "502 Bad Gateway" no Traefik
- App ainda subindo (~20s no boot, mais nas primeiras execuções por causa de
  migrations).
- Verifique `docker service ps casa-roxa_app` — todos `Running`?

### Auth.js retorna `UntrustedHost`
- Confirme `AUTH_TRUST_HOST=true` está setado no environment do serviço `app`.
- Em logs vai aparecer `[next-auth][error][UNTRUSTED_HOST]`.

### Como derrubar a stack inteira
```bash
docker stack rm casa-roxa
# volume permanece (postgres data) — pra remover:
docker volume rm casa-roxa_casa_roxa_postgres_data
```

---

## Arquitetura resumida

```
                 ┌─────────────────────────────┐
                 │       Cloudflare DNS        │
                 └──────────────┬──────────────┘
                                ▼
                 ┌─────────────────────────────┐
                 │   Traefik (já existente)    │
                 │   na rede traefik-public    │
                 │   certresolver: le          │
                 └──────────────┬──────────────┘
              ┌─────────────────┴─────────────────┐
              ▼                                   ▼
   ┌──────────────────────┐            ┌──────────────────────┐
   │  casaroxa.com.br     │            │ gestao.casaroxa.com.br│
   │  router 'public'     │            │  router 'admin'      │
   └──────────┬───────────┘            └────────────┬─────────┘
              └────────────┬──────────────────────────┘
                           ▼
                  ┌────────────────┐
                  │ casa-roxa_app  │  ← traefik-public + casa-roxa-internal
                  │  Next.js :3000 │
                  │  middleware    │  ← decide pelo Host header
                  └────────┬───────┘
                           ▼  (rede casa-roxa-internal)
                  ┌────────────────┐
                  │casa-roxa_postgres│
                  │  Postgres 16    │
                  └────────────────┘
```

---

## Checklist final

- [ ] DNS propagado (3 hosts apontando para o Traefik)
- [ ] Imagem pushada no GHCR (`ghcr.io/brunojustog/casa-roxa-gestao:latest`)
- [ ] Variáveis configuradas no Portainer
- [ ] Stack deployada (`docker stack ls` mostra `casa-roxa`)
- [ ] Logs do app: "Iniciando Next..." sem erros
- [ ] Logs do Postgres: aceitando conexões
- [ ] Acesso público: https://casaroxa.com.br carrega landing
- [ ] Acesso admin: https://gestao.casaroxa.com.br/login funciona
- [ ] Login com SEED_ADMIN_EMAIL/PASSWORD funciona
- [ ] Trocar senha do admin (manualmente no banco — UI de troca não existe ainda)
- [ ] Configurar backup automatizado via cron
