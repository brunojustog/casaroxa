# Encomendas (admin)

Encomenda = pedido pra **data futura** (não é pra hoje). Cliente pede com antecedência, você produz no dia. Diferente da Pré-venda (lote fechado coletivo) e do Pedido normal (entrega imediata).

## Quando usar encomenda

- "Quero 2 picanhas pra sábado às 18h, aniversário"
- "5 frangos pra domingo de manhã"
- "Combo da família pra um almoço terça"

## Como o cliente faz (lado dele)

1. Cliente clica em **Encomendar** no header do site.
2. Escolhe os produtos por categoria (Combos primeiro, depois Frangos, Costela, etc).
3. Preenche nome, telefone, **data/hora desejada** (mín. 48h adiante por padrão).
4. Escolhe Retirada ou Delivery (com endereço).
5. Envia.

O cliente recebe imediatamente:
- Mensagem WhatsApp: "Recebemos sua encomenda ER-N. Vamos confirmar em breve." (se toggle ligado)
- Página de tracking: `/encomenda/[id]` mostrando status PENDENTE.

## Recebendo no painel

1. Push notification dispara no seu navegador quando entra encomenda.
2. Vá em **Sidebar → Cadastros → Encomendas**.
3. Encomendas PENDENTES aparecem no topo com banner amarelo "X pendentes".

## Aprovar encomenda

1. Clique na encomenda PENDENTE.
2. Confira:
   - Cliente (nome + telefone)
   - Data/hora desejada
   - Modalidade (Retirada ou Delivery + endereço)
   - Itens e total
3. Clique **Aprovar**.
4. Sistema pergunta: **"Pedir sinal antecipado?"**
   - **OK (sim):** digite o valor em R$ (ex.: 50,00). Sistema tenta gerar charge Asaas PIX automaticamente.
   - **Cancelar (não):** aprovação direta, sem cobrança antecipada.
5. Sistema pergunta observações internas (opcional, só você vê).

**O que acontece ao aprovar:**
- Status: PENDENTE → APROVADA
- Sale (`Sale`) é criada automaticamente como ABERTA, com source=OUTRO e notes contendo o snapshot do cliente
- Se há sinal: cobrança Asaas é criada (se cliente tem CPF) ou gera link auto-serviço (se não tem)
- Cliente recebe WhatsApp: "Sua encomenda foi confirmada pra [data]. Sinal: R$ X. Pague aqui: [link]"

**Atenção:** o link do WhatsApp aponta pra `casaroxa.com.br/encomenda/[id]` (a tracking do cliente), **não** pro Asaas direto. Na tracking ele vê QR Code PIX inline + botão de copiar PIX, sem precisar sair do nosso site.

## Recusar encomenda

1. Clique **Recusar**.
2. Digite o motivo (obrigatório, visível ao cliente).
3. Cliente recebe WhatsApp: "Não conseguimos atender sua encomenda. Motivo: ..." (se toggle ligado)
4. Status vira RECUSADA, não é convertida em Sale.

## Sinal — gerenciar pagamento

Se você aprovou com sinal:

### Cliente tem CPF cadastrado
- Charge Asaas foi criada automaticamente.
- Link de pagamento (`invoiceUrl`) está disponível no painel e na mensagem WhatsApp.
- Quando cliente paga, webhook do Asaas marca `depositPaidAt` automaticamente — você não precisa fazer nada.

### Cliente NÃO tem CPF
- Charge não foi criada (Asaas exige CPF).
- WhatsApp manda link pra tracking, onde cliente preenche o CPF → gera link → paga.
- Mesmo webhook automático no fim.

### Sinal em dinheiro / PIX direto pra você (não pelo Asaas)
- Quando receber, clique **Confirmar sinal recebido** no painel.
- Marca `depositPaidAt` manualmente.

## Avançar status

Status flow: PENDENTE → APROVADA → EM_PRODUCAO → PRONTA → ENTREGUE

| Status | Quando marcar | O que faz |
|---|---|---|
| APROVADA | Logo após aprovar | Cria Sale ABERTA + envia WhatsApp |
| EM_PRODUCAO | Cozinha começou | Apenas atualiza UI |
| PRONTA | Encomenda pronta pra retirada/entrega | Envia WhatsApp "Pode vir buscar" ou "Estamos saindo pra entrega" |
| ENTREGUE | Cliente recebeu | Fecha a Sale como CONCLUIDA |

**Dica:** se cliente cancelar (em qualquer status), clique **Cancelar** — sistema também cancela a Sale vinculada automaticamente.

## Conferir antes de produzir

Vá em **Sidebar → Operação → Produção** e escolha a data desejada da encomenda. Você vê:

- **Lista de produção** — quanto produzir de cada item (consolidando todas as encomendas + pré-vendas daquele dia)
- **Lista de compras** — quanto comprar de cada ingrediente (calculado pelas fichas técnicas)

Use o botão **Imprimir** pra levar pro açougue/mercado.

## Como o cliente acompanha

Ele recebe link `casaroxa.com.br/encomenda/[id]` no WhatsApp e pode reabrir a qualquer momento. Na tela ele vê:
- Status atual com mensagem amigável
- Itens encomendados
- Sinal (se há): valor, status (pago / aguardando), QR PIX inline se aguardando
- Quando aprovada e gerou Sale, link pra `/pedido/[id]` (a tracking de Sale com progresso de cozinha)

## Erros comuns

| Erro | Causa | Solução |
|---|---|---|
| "Cliente sem CPF cadastrado" | Cliente fez encomenda como novo, sem CPF | Pede CPF pelo WhatsApp → cadastra em **Clientes**, ou orienta cliente a preencher na tracking |
| WhatsApp não chegou | Toggle desligado em Configurações | Liga "Encomenda aprovada/pronta/etc" em /configuracoes |
| Encomenda sumiu | Tem mais de 24h sem ação | Verifica filtro de status — pode estar em RECUSADA/CANCELADA |
| Charge Asaas duplicada | Você clicou Aprovar 2 vezes | Sistema é idempotente, mas se gerou 2: cancela uma manualmente no painel do Asaas |

## Configurar antecedência mínima

Por padrão são 48h. Pra mudar:

1. **Sidebar → Configurações → Encomendas**
2. Campo "Antecedência mínima (horas)" — aceita 1 a 720 (1 mês).
3. Salve. Vale pra encomendas novas criadas pelo site (a sua criação manual ignora esse limite).

## Por debaixo dos panos

- Tabela: `OrderRequest` + `OrderRequestItem`
- Estados: `OrderRequestStatus` (PENDENTE, APROVADA, RECUSADA, EM_PRODUCAO, PRONTA, ENTREGUE, CANCELADA)
- Polimorfismo de pagamento: `OnlinePayment.orderRequestId` (alternativa a saleId e raffleId)
- Sinal Asaas: gerado via `initiateOrderRequestDepositPayment` no `payment.service`
- WhatsApp: 4 eventos (`ORDER_REQUEST_RECEIVED`, `ORDER_REQUEST_APPROVED`, `ORDER_REQUEST_REJECTED`, `ORDER_REQUEST_READY`) com toggle individual
