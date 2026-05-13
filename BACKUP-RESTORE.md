# Backup & Restore — Casa Roxa Gestão

## O que está sendo feito

**Diariamente às 03h00 UTC** o script `/root/backup-casaroxa.sh` no manager da VPS executa:

1. `pg_dump` do banco `casa_roxa` (container `casaroxa_postgres`)
2. Compressão gzip nível 9
3. Upload via `rsync` (SSH key) pra Storage Box Hetzner BX11 (`u561235.your-storagebox.de`)
4. Rotação automática (delete dos antigos)

## Onde os arquivos ficam

**Storage Box Hetzner** (off-site, sobrevive se VPS pifar):

```
u561235.your-storagebox.de:casaroxa/postgres/
├── daily/      ← último dump de cada dia (mantém 7)
├── weekly/     ← dump de domingo (mantém 4)
└── monthly/    ← dump de dia 1 do mês (mantém 6)
```

**Manager VPS** (cache local, mantém 2 dias):

```
/var/tmp/backups/casaroxa-YYYY-MM-DD.sql.gz
```

## Política de retenção

| Pasta | Frequência | Mantém | Janela coberta |
|---|---|---|---|
| `daily/` | todo dia | 7 | última semana |
| `weekly/` | domingo | 4 | último mês |
| `monthly/` | dia 1 | 6 | últimos 6 meses |

Total: ~17 backups por DB. Cada um ~30 KB hoje (banco pequeno) — vai crescer com produção.

## Como ver se está rodando

```bash
ssh root@manager
# Log do último backup
tail -50 /var/log/backup-casaroxa.log

# Cron instalado
crontab -l | grep casaroxa

# Arquivos na storage box
ssh -i ~/.ssh/storagebox -p 23 u561235@u561235.your-storagebox.de \
  "ls -lt casaroxa/postgres/daily/"
```

## Como restaurar

### Cenário A: rollback rápido (mesmo banco, sobrescrever)

```bash
ssh root@manager

# 1. Escolhe qual dump usar (geralmente o último daily)
DUMP_FILE="casaroxa-2026-05-13.sql.gz"

# 2. Baixa da storage box pro manager
mkdir -p /tmp/restore && cd /tmp/restore
scp -i ~/.ssh/storagebox -P 23 \
  u561235@u561235.your-storagebox.de:casaroxa/postgres/daily/$DUMP_FILE .

# 3. Descomprime
gunzip $DUMP_FILE
SQL_FILE="${DUMP_FILE%.gz}"

# 4. Para o app (evita escrita concorrente)
docker service scale casaroxa_app=0
sleep 5

# 5. Restaura no Postgres
PG=$(docker ps --format '{{.Names}}' | grep '^casaroxa_postgres' | head -1)
docker cp $SQL_FILE $PG:/tmp/restore.sql
docker exec $PG psql -U casaroxa -d casa_roxa -f /tmp/restore.sql

# 6. Sobe o app de volta
docker service scale casaroxa_app=1

# 7. Confirma
docker exec $PG psql -U casaroxa -d casa_roxa -c "
SELECT COUNT(*) customers FROM \"Customer\";
SELECT COUNT(*) sales FROM \"Sale\";
"

# 8. Limpa
rm /tmp/restore/$SQL_FILE
```

### Cenário B: clone pra staging / teste

Restaurar num DB diferente (sem mexer na produção):

```bash
# Cria DB temporário
docker exec $PG psql -U casaroxa -d postgres -c "CREATE DATABASE casa_roxa_test;"

# Restaura nele
docker exec $PG psql -U casaroxa -d casa_roxa_test -f /tmp/restore.sql

# Para checar
docker exec $PG psql -U casaroxa -d casa_roxa_test -c "SELECT count(*) FROM \"Sale\";"

# Quando terminar
docker exec $PG psql -U casaroxa -d postgres -c "DROP DATABASE casa_roxa_test;"
```

### Cenário C: VPS perdida (recuperação total)

1. Provisionar nova VPS, instalar Docker Swarm, redeploy do stack vazio (Postgres + app)
2. Da Storage Box, baixar dump mais recente (`daily/` ou `weekly/`)
3. Restaurar via Cenário A

A Storage Box é independente da VPS — segura mesmo se o servidor pegar fogo.

## Script (referência)

Localização no manager: `/root/backup-casaroxa.sh`

Pontos chave:
- Usa `--clean --if-exists --no-owner` (idempotente, sem erros de owner)
- Compressão gzip -9 (melhor taxa)
- Rotação via SFTP (storage box Hetzner não tem shell)
- Lock natural via cron (Linux serializa execuções do mesmo job)

## Teste do restore

**Sem testar restore, não tem backup**. Recomendado: roda um teste de restore por mês pra confirmar que dumps são válidos. Use **Cenário B** — clona em DB de teste, valida, dropa.

## Limitações conhecidas

- **Não cobre uploads/files** — banco hoje não tem upload de imagem. Se mudar, incluir tar do volume.
- **RTO** (recovery time objective): ~10 min se VPS de pé / ~1h se precisar provisionar nova
- **RPO** (recovery point objective): até 24h de dados perdidos (backup diário). Se quiser melhor, precisa de PITR (write-ahead logs) ou replicação.
- **Storage Box single-region** (FSN1, Falkenstein/DE). Bem isolada da VPS de produção, mas mesma área geográfica.

## Variáveis sensíveis

- Chave SSH da storage box: `/root/.ssh/storagebox` (no manager)
- Public key cadastrada: `u561235@u561235.your-storagebox.de:.ssh/authorized_keys`
- Senha SSH original: trocada por chave; pode ser resetada no painel se necessário.

---

**Última atualização:** 2026-05-13
