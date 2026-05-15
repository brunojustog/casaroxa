# Primeiros passos no painel (operador)

Tudo que você precisa saber pra começar a atender pedidos no painel admin.

## 1. Entrar no painel

1. Acesse [`gestao.casaroxa.com.br`](https://gestao.casaroxa.com.br).
2. Use seu email cadastrado e a senha que o Bruno te passou.
3. Se esquecer a senha, peça pro Bruno resetar — não há "esqueci minha senha" automático.

**Atenção:** o painel é `gestao.casaroxa.com.br`. Se você acessar `casaroxa.com.br` (sem o `gestao.`), você cai no cardápio público (o que o cliente vê).

## 2. Entender a sidebar

Como operador, você vê:

| Seção | O que faz |
|---|---|
| **Cozinha** | Tela KDS — fila de pedidos em tempo real |
| **Estoque** | Saldo atual dos ingredientes, alertas de mínimo |
| **Inventário** | Contagens cíclicas pra ajustar saldo físico |
| **Vendas** | Lista de pedidos (atender, finalizar, cancelar) |
| **Clientes** | CRM básico — buscar cliente, ver histórico |
| **Dashboard** | KPIs do dia/semana/mês |
| **Assistente IA** | Conversa com o sistema em linguagem natural |

Você **não vê** (precisa de admin):
- Cadastros (Produtos, Combos, Fichas, Ingredientes, Cupons, Sorteios, Pré-vendas, Encomendas)
- Compras (lançar NFe, fornecedores)
- Financeiro (custos fixos, DRE, simulador)
- Campanhas, NPS, Carrinhos abandonados
- Configurações
- Aprovações da IA

Se você acessar uma dessas URLs direto, o sistema te redireciona pra `/vendas`.

## 3. Fluxo do dia (visão geral)

**Manhã:**
1. Abre o painel → vai pra **Cozinha**.
2. Confere se WhatsApp está conectado (ícone verde no canto). Se não, avisa o Bruno.
3. Confere o **Dashboard** rapidamente — pedidos previstos, alertas de estoque mínimo.

**Durante o dia:**
1. **Pedido entra** → aparece na Cozinha como "NOVO" + notificação push no browser.
2. Você marca como **Confirmado** → cliente recebe WhatsApp automático (se toggle ligado).
3. Cozinha prepara → você marca como **Preparando** → **Pronto** → **Saiu pra entrega** → **Entregue**.
4. Cada transição pode disparar WhatsApp automático (configurado em **Configurações** pelo admin).

**Fim do dia:**
1. Confere se todos os pedidos estão **Entregue** ou **Cancelado**.
2. Se sobrou pedido travado, fala com o Bruno.

## 4. Dicas que economizam tempo

- **Atalho do KDS:** deixe a aba aberta — ela auto-refresh a cada 5 segundos. Não precisa F5.
- **Notificação push:** quando entra pedido novo, o navegador toca um som e mostra um banner. Permita notificações na primeira vez que abrir.
- **Buscar cliente rápido:** vá em **Clientes** e digite parte do nome ou telefone. O histórico de pedidos aparece junto.
- **Status errado:** se você marcou "Pronto" sem querer, dá pra voltar — clique na barra de progresso do pedido e selecione o status anterior.

## 5. O que NÃO fazer

- ❌ **Não cancele pedido sem confirmar com o Bruno** — cancelamento reverte estoque, e dependendo da forma de pagamento, exige estorno manual no Asaas.
- ❌ **Não edite pedido já pago online** — pode dessincronizar com Asaas. Em caso de erro, fala com o Bruno.
- ❌ **Não responda WhatsApp pelo wuzapi** — ele só envia. Resposta do cliente vai pro WhatsApp normal do número da Casa Roxa.
- ❌ **Não compartilhe sua senha** — cada operador tem login próprio pra rastreabilidade.

## 6. Quando chamar o Bruno

| Situação | Por quê |
|---|---|
| Pedido pago online travou em "ABERTA" depois do webhook | Pode ter falha no Asaas; ele resolve direto no painel |
| Pedido com cupom estranho (preço zerado por engano) | Confirmar se foi cupom legítimo |
| Cliente reclamando que recebeu mensagem duplicada/errada | Pode ter bug no WhatsApp toggle |
| Encomenda nova chegou pelo site | Só admin aprova encomenda — não é seu papel |
| NPS muito baixo (cliente deu nota 0–3) | Detrator — Bruno decide se entra em campanha de recuperação |

## 7. Sair com segurança

- No canto superior direito do painel, clique no seu avatar → **Sair**.
- Sessão expira após X horas de inatividade (configurável). Se você abrir o painel e estiver na tela de login, é normal.
