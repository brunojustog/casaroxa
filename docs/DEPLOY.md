# Deploy — Casa Roxa em VPS Debian 12

Stack: Docker Compose + Traefik (proxy + SSL automático) + Next.js + Postgres 16.

Hosts:
- **`casaroxa.com.br`** → cardápio público (cliente final)
- **`gestao.casaroxa.com.br`** → admin (login + sistema)

A mesma instância da app responde aos dois domínios; o middleware do Next faz roteamento por host.

---

## 1. Pré-requisitos

No servidor (Debian 12 com IP público e SSH ativo):

- Acesso `sudo` ou root.
- Domínios já apontando pro IP do servidor:
  - `casaroxa.com.br` → A record para o IP
  - `www.casaroxa.com.br` → A record para o IP (opcional, redireciona)
  - `gestao.casaroxa.com.br` → A record para o IP

Confira o DNS antes de prosseguir:
```bash
dig casaroxa.com.br
dig gestao.casaroxa.com.br
```
Os dois precisam retornar o IP do VPS.

---

## 2. Instalar Docker + Compose no servidor

```bash
# Como root ou com sudo
apt update && apt upgrade -y
apt install -y ca-certificates curl gnupg git ufw

# Docker (script oficial)
curl -fsSL https://get.docker.com | sh

# Habilita Docker no boot
systemctl enable --now docker

# Verifica
docker --version
docker compose version
```

---

## 3. Firewall (UFW)

Abre apenas o necessário:

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp        # SSH
ufw allow 80/tcp        # HTTP (Traefik redireciona pra HTTPS)
ufw allow 443/tcp       # HTTPS
ufw enable
```

> Postgres (5432) **não** é exposto — fica só na rede interna do Docker.

---

## 4. Clonar o repositório

Crie um usuário `deploy` (opcional mas recomendado):

```bash
adduser deploy
usermod -aG docker deploy
su - deploy
```

Clone o repo:

```bash
git clone https://github.com/brunojustog/casaroxa.git
cd casaroxa
```

---

## 5. Configurar `.env.production`

```bash
cp .env.production.example .env.production
nano .env.production
```

Preencha:

| Variável | Valor |
|---|---|
| `PUBLIC_DOMAIN` | `casaroxa.com.br` |
| `ADMIN_DOMAIN` | `gestao.casaroxa.com.br` |
| `LETSENCRYPT_EMAIL` | seu email (recebe avisos de SSL) |
| `POSTGRES_PASSWORD` | senha forte gerada (`openssl rand -base64 24`) |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `ANTHROPIC_API_KEY` | mesma do `.env` local ou nova |
| `SEED_ADMIN_EMAIL` | email do admin |
| `SEED_ADMIN_PASSWORD` | senha forte do admin |

**Importante:** o `.env.production` **nunca** vai pro Git (já está no `.gitignore`).

---

## 6. Subir os containers

```bash
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

Isso vai:
1. Buildar a imagem Next a partir do `Dockerfile`.
2. Subir Postgres 16 (volume persistente).
3. Aplicar migrations (`prisma migrate deploy`).
4. Rodar seed (idempotente — cria admin se não existir).
5. Subir Traefik (provisiona certificados Let's Encrypt automaticamente).

Aguarde ~1-2min na primeira execução (build + emissão de certificados).

---

## 7. Validar

Logs em tempo real:

```bash
docker compose -f docker-compose.production.yml logs -f app
docker compose -f docker-compose.production.yml logs -f traefik
```

Procure por:
- `Listening on 0.0.0.0:3000` no `app`
- `Server configuration reloaded` no `traefik`
- `Certificate obtained` no `traefik`

Teste no navegador:
- https://casaroxa.com.br → landing pública
- https://gestao.casaroxa.com.br → redireciona pra `/login`
- https://gestao.casaroxa.com.br/login → tela de login

---

## 8. Pós-deploy: trocar senha do admin

1. Login com `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD`.
2. *(Funcionalidade de troca de senha ainda não está na UI — por enquanto, troque direto no banco se precisar:)*
   ```bash
   docker compose -f docker-compose.production.yml exec app npx tsx -e "..."
   ```

---

## 9. Atualizações de código (deploy contínuo)

A cada mudança que você quiser deployar:

```bash
cd ~/casaroxa
git pull
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

O entrypoint roda migrations automaticamente ao subir.

---

## 10. Backup do banco

Cron diário sugerido (`crontab -e` como `deploy`):

```cron
0 3 * * * docker exec casa-roxa-postgres pg_dump -U casaroxa casa_roxa | gzip > /home/deploy/backups/casa_roxa_$(date +\%F).sql.gz
0 4 * * 0 find /home/deploy/backups -name "*.sql.gz" -mtime +30 -delete
```

Faz backup diário às 3h e remove backups com mais de 30 dias semanalmente.

Pra restaurar:
```bash
gunzip < backup.sql.gz | docker exec -i casa-roxa-postgres psql -U casaroxa casa_roxa
```

---

## Troubleshooting

### Certificado SSL não emite
- Verifique DNS: `dig PUBLIC_DOMAIN` deve retornar o IP.
- Veja logs: `docker compose -f docker-compose.production.yml logs traefik`
- Let's Encrypt tem rate limit de 5 falhas por hora — espere antes de re-tentar.

### App em loop de restart
- `docker compose -f docker-compose.production.yml logs app` — provavelmente migration falhou.
- Confira `DATABASE_URL` no `.env.production`.

### "502 Bad Gateway" no Traefik
- App não está respondendo. Veja logs do app.
- Pode ser que esteja rodando migrations e demorando (~30s).

### Mudança no schema
1. Localmente: edite `prisma/schema.prisma`.
2. Gere migration: `npx prisma migrate dev --name <descricao>`.
3. Commit + push.
4. No servidor: `git pull && docker compose -f docker-compose.production.yml --env-file .env.production up -d --build`.

---

## Arquitetura resumida

```
                 ┌─────────────────────────────┐
                 │        Internet (443)       │
                 └──────────────┬──────────────┘
                                ▼
                       ┌─────────────────┐
                       │     Traefik     │
                       │   Let's Encrypt │
                       │   2 routers     │
                       └────────┬────────┘
              ┌─────────────────┴─────────────────┐
              ▼                                   ▼
   ┌──────────────────────┐            ┌──────────────────────┐
   │  casaroxa.com.br     │            │ gestao.casaroxa.com.br│
   │  (cardápio público)  │            │  (admin/login)        │
   └──────────┬───────────┘            └────────────┬─────────┘
              └────────────┬──────────────────────────┘
                           ▼
                  ┌────────────────┐
                  │  Next.js (app) │
                  │   middleware   │  ←  decide roteamento por Host
                  │   :3000        │
                  └────────┬───────┘
                           ▼
                  ┌────────────────┐
                  │   Postgres 16  │
                  │   (interno)    │
                  └────────────────┘
```
