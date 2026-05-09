# Rotação de credenciais

Passo a passo pra trocar todas as credenciais que possam ter vazado (em
chats, logs, screenshots etc). Faça **uma de cada vez** e teste antes de
ir pra próxima.

Stack: `casaroxa` (ajuste se for diferente). Domínio admin: `gestao.casaroxa.com.br`.

---

## 1. ANTHROPIC_API_KEY (mais urgente)

Chaves vazadas podem ser usadas por terceiros até serem revogadas. **Faça
isso primeiro.**

1. Acesse https://console.anthropic.com/settings/keys
2. Encontre a chave atual e clique no menu (3 pontos) → **Revoke**
3. Clique **Create Key** → nome: `casaroxa-prod-2026-05` → **Create**
4. **Copie** o token novo (começa com `sk-ant-api03-...`) — só aparece uma vez.
5. No Portainer: **Stacks → casaroxa → Editor**
6. Procure `ANTHROPIC_API_KEY:` e substitua o valor.
7. Marque **"Re-pull image"** (não obrigatório aqui, mas recomendado) e clique **Update the stack**.
8. Aguarde ~30s e teste o chat IA em https://gestao.casaroxa.com.br/assistente.

**Verificação:** se o chat responder normalmente, OK. Se der "ANTHROPIC_API_KEY não configurada", o env não chegou — refaça o update.

---

## 2. AUTH_SECRET

Trocar o secret **invalida todas as sessões ativas** — todo mundo precisa
fazer login de novo. Faça isso fora de horário de pico se for evitar atrito.

1. Gere o novo secret na sua máquina:
   ```powershell
   # Windows PowerShell
   $bytes = New-Object byte[] 32
   [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
   [Convert]::ToBase64String($bytes)
   ```
   ou
   ```bash
   # Linux/macOS
   openssl rand -base64 32
   ```
2. Portainer → **Stacks → casaroxa → Editor**
3. Substitua o `AUTH_SECRET:` pelo valor novo.
4. **Update the stack**.
5. Saia da sessão e faça login de novo.

---

## 3. POSTGRES_PASSWORD

Trocar a senha do Postgres já em uso é o passo **mais delicado**. O
Postgres não usa `POSTGRES_PASSWORD` depois da inicialização — você
precisa fazer um `ALTER USER` antes de atualizar o env.

1. Gere a nova senha:
   ```bash
   openssl rand -base64 24 | tr -d '/+='
   ```
2. SSH no host Swarm. Encontre o container do Postgres:
   ```bash
   docker ps -qf name=casaroxa_postgres
   ```
3. Aplica a nova senha **antes** de atualizar a stack:
   ```bash
   docker exec -it <container_id> psql -U casaroxa -d casa_roxa \
     -c "ALTER USER casaroxa WITH PASSWORD 'NOVA_SENHA_AQUI';"
   ```
4. Portainer → **Stacks → casaroxa → Editor**:
   - Substitua `POSTGRES_PASSWORD:` pela nova senha (em **dois lugares**:
     no service `app` dentro de `DATABASE_URL`, e no service `postgres`
     dentro de `environment.POSTGRES_PASSWORD`).
5. **Update the stack**.
6. Aguarde o app subir (~30s) e teste o login.

> **Se a app entrar em loop de erro de auth no Postgres**, é porque a
> senha no env não bate com a real. Reverta o env temporariamente, faz
> ALTER USER de novo com a senha que deu certo, e tenta atualizar.

---

## 4. SEED_ADMIN_PASSWORD (senha de login do admin)

Diferente das outras, a senha do admin **não é alterada pelo env** depois
que o usuário existe — o seed só cria, não atualiza senha. Use o script
dedicado:

1. Escolha a nova senha (forte, 12+ caracteres).
2. SSH no host Swarm:
   ```bash
   APP_CONTAINER=$(docker ps -qf name=casaroxa_app | head -1)
   docker exec -it "$APP_CONTAINER" \
     npx tsx scripts/set-admin-password.ts bruno@simplificaonline.site 'NOVA_SENHA_AQUI'
   ```
3. Atualize também o `SEED_ADMIN_PASSWORD` na stack do Portainer
   (não afeta o que já existe, mas mantém consistência caso o banco
   seja recriado).
4. Teste o login com a nova senha em https://gestao.casaroxa.com.br/login.

> Se você usar caracteres especiais na senha (`$`, `\`, etc), use aspas
> simples em volta do argumento (como mostrado acima) pra shell não
> interpretá-los.

---

## Checklist final

- [ ] Anthropic API key antiga revogada (verificar em console.anthropic.com)
- [ ] Anthropic API key nova funcionando (chat IA respondendo)
- [ ] AUTH_SECRET novo no Portainer
- [ ] Login com sessão nova funciona
- [ ] POSTGRES_PASSWORD trocada via ALTER USER + env atualizado
- [ ] App conecta no banco com senha nova
- [ ] SEED_ADMIN_PASSWORD trocada via script
- [ ] Login funciona com senha nova
- [ ] Conferir Portainer não mostra warnings/errors
