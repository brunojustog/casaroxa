/**
 * Seed inicial da Casa Roxa — Gestão.
 *
 * Cria:
 *  - 1 usuário admin (env SEED_ADMIN_*)
 *  - Settings singleton com valores padrão
 *  - Catálogo de ingredientes (~65) com preços de referência
 *  - Catálogo de produtos (~33) por categoria
 *  - Fichas técnicas iniciais para os produtos principais
 *  - 16 combos com seus itens e preços de venda sugeridos
 *
 * Idempotente: pode ser rodado múltiplas vezes sem duplicar dados.
 *   npm run db:seed
 */
import {
  IngredientCategory,
  IngredientUnit,
  PrismaClient,
  ProductCategory,
  ProductStatus,
  ProductType,
  UserRole,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ============================================================
// 1. ADMIN
// ============================================================
async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@casaroxa.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "casa-roxa-2026";
  const name = process.env.SEED_ADMIN_NAME ?? "Administrador";
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, role: UserRole.ADMIN },
    create: { email, name, passwordHash, role: UserRole.ADMIN },
  });
  console.log(`✓ Admin: ${user.email}`);
}

// ============================================================
// 2. SETTINGS
// ============================================================
async function seedSettings() {
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  console.log("✓ Settings padrão");
}

// ============================================================
// 3. INGREDIENTES
// ============================================================
type IngredientSeed = {
  name: string;
  category: IngredientCategory;
  unit: IngredientUnit;
  unitCost: number;
  supplier?: string;
};

const INGREDIENTS: IngredientSeed[] = [
  // CARNES
  { name: "Frango inteiro",          category: "CARNE", unit: "KG", unitCost: 8.99,  supplier: "AstraPlus" },
  { name: "Coxa e sobrecoxa",        category: "CARNE", unit: "KG", unitCost: 12.99 },
  { name: "Costela bovina",          category: "CARNE", unit: "KG", unitCost: 38.90 },
  { name: "Costelinha suína",        category: "CARNE", unit: "KG", unitCost: 19.90 },
  { name: "Panceta/barriga de porco",category: "CARNE", unit: "KG", unitCost: 22.90 },
  { name: "Joelho de porco",         category: "CARNE", unit: "UNIDADE", unitCost: 18.90 },
  { name: "Lombo suíno",             category: "CARNE", unit: "KG", unitCost: 24.90 },
  { name: "Pernil suíno",            category: "CARNE", unit: "KG", unitCost: 19.90 },

  // TEMPEROS / CONDIMENTOS
  { name: "Sal refinado",            category: "TEMPERO", unit: "G",  unitCost: 0.005 },
  { name: "Sal grosso",              category: "TEMPERO", unit: "G",  unitCost: 0.005 },
  { name: "Alho",                    category: "TEMPERO", unit: "G",  unitCost: 0.040 },
  { name: "Cebola",                  category: "TEMPERO", unit: "G",  unitCost: 0.005 },
  { name: "Limão",                   category: "TEMPERO", unit: "UNIDADE", unitCost: 0.80 },
  { name: "Vinagre",                 category: "TEMPERO", unit: "ML", unitCost: 0.008 },
  { name: "Óleo",                    category: "TEMPERO", unit: "ML", unitCost: 0.012 },
  { name: "Azeite",                  category: "TEMPERO", unit: "ML", unitCost: 0.060 },
  { name: "Colorau",                 category: "TEMPERO", unit: "G",  unitCost: 0.030 },
  { name: "Páprica doce",            category: "TEMPERO", unit: "G",  unitCost: 0.080 },
  { name: "Páprica defumada",        category: "TEMPERO", unit: "G",  unitCost: 0.150 },
  { name: "Pimenta-do-reino",        category: "TEMPERO", unit: "G",  unitCost: 0.200 },
  { name: "Chimichurri",             category: "TEMPERO", unit: "G",  unitCost: 0.100 },
  { name: "Ervas secas",             category: "TEMPERO", unit: "G",  unitCost: 0.080 },
  { name: "Cheiro-verde",            category: "TEMPERO", unit: "G",  unitCost: 0.020 },
  { name: "Louro",                   category: "TEMPERO", unit: "G",  unitCost: 0.150 },
  { name: "Manteiga/margarina",      category: "TEMPERO", unit: "G",  unitCost: 0.030 },
  { name: "Mostarda",                category: "TEMPERO", unit: "ML", unitCost: 0.015 },
  { name: "Mel",                     category: "TEMPERO", unit: "ML", unitCost: 0.040 },
  { name: "Açúcar mascavo",          category: "TEMPERO", unit: "G",  unitCost: 0.012 },
  { name: "Molho barbecue pronto",   category: "TEMPERO", unit: "ML", unitCost: 0.025 },

  // ACOMPANHAMENTOS / INSUMOS BASE
  { name: "Arroz",                   category: "ACOMPANHAMENTO", unit: "G",  unitCost: 0.008 },
  { name: "Macarrão",                category: "ACOMPANHAMENTO", unit: "G",  unitCost: 0.010 },
  { name: "Molho de tomate",         category: "ACOMPANHAMENTO", unit: "ML", unitCost: 0.015 },
  { name: "Mandioca",                category: "ACOMPANHAMENTO", unit: "G",  unitCost: 0.008 },
  { name: "Batata",                  category: "ACOMPANHAMENTO", unit: "G",  unitCost: 0.007 },
  { name: "Farinha de mandioca/biju",category: "ACOMPANHAMENTO", unit: "G",  unitCost: 0.012 },
  { name: "Bacon",                   category: "ACOMPANHAMENTO", unit: "G",  unitCost: 0.045 },
  { name: "Calabresa",               category: "ACOMPANHAMENTO", unit: "G",  unitCost: 0.030 },
  { name: "Cenoura",                 category: "ACOMPANHAMENTO", unit: "G",  unitCost: 0.006 },
  { name: "Maionese industrial",     category: "ACOMPANHAMENTO", unit: "G",  unitCost: 0.018 },
  { name: "Milho",                   category: "ACOMPANHAMENTO", unit: "G",  unitCost: 0.020 },
  { name: "Ervilha",                 category: "ACOMPANHAMENTO", unit: "G",  unitCost: 0.025 },
  { name: "Azeitona",                category: "ACOMPANHAMENTO", unit: "G",  unitCost: 0.060 },
  { name: "Ovos",                    category: "ACOMPANHAMENTO", unit: "UNIDADE", unitCost: 1.00 },
  { name: "Tomate",                  category: "ACOMPANHAMENTO", unit: "G",  unitCost: 0.010 },
  { name: "Pimentão",                category: "ACOMPANHAMENTO", unit: "G",  unitCost: 0.012 },

  // INSUMOS AGRUPADOS (porção pré-calculada)
  { name: "Tempero da casa",         category: "TEMPERO", unit: "PORCAO", unitCost: 2.00 },
  { name: "Rateio gás e perdas",     category: "GAS",     unit: "PORCAO", unitCost: 2.50 },

  // EMBALAGENS
  { name: "Embalagem frango inteiro",category: "EMBALAGEM", unit: "UNIDADE", unitCost: 1.07 },
  { name: "Embalagem coxa/sobrecoxa",category: "EMBALAGEM", unit: "UNIDADE", unitCost: 0.85 },
  { name: "Embalagem costela",       category: "EMBALAGEM", unit: "UNIDADE", unitCost: 1.20 },
  { name: "Marmitex/alumínio",       category: "EMBALAGEM", unit: "UNIDADE", unitCost: 0.65 },
  { name: "Pote 250g",               category: "EMBALAGEM", unit: "UNIDADE", unitCost: 0.55 },
  { name: "Pote 500g",               category: "EMBALAGEM", unit: "UNIDADE", unitCost: 0.85 },
  { name: "Pote molho pequeno",      category: "EMBALAGEM", unit: "UNIDADE", unitCost: 0.35 },
  { name: "Sacola reforçada",        category: "EMBALAGEM", unit: "UNIDADE", unitCost: 0.40 },
  { name: "Etiqueta/lacre",          category: "EMBALAGEM", unit: "UNIDADE", unitCost: 0.10 },
  { name: "Papel alumínio",          category: "EMBALAGEM", unit: "UNIDADE", unitCost: 0.50 },
  { name: "Filme plástico",          category: "EMBALAGEM", unit: "UNIDADE", unitCost: 0.30 },

  // GÁS / CARVÃO
  { name: "Gás botijão (13kg)",      category: "GAS", unit: "BOTIJAO", unitCost: 130.00 },
  { name: "Carvão",                  category: "GAS", unit: "KG",      unitCost: 8.00 },

  // LIMPEZA / EPI
  { name: "Produtos de limpeza",     category: "LIMPEZA", unit: "UNIDADE", unitCost: 5.00 },
  { name: "Luvas/toucas/EPIs",       category: "LIMPEZA", unit: "UNIDADE", unitCost: 0.30 },

  // BEBIDAS
  { name: "Refrigerante 2L (insumo)",category: "BEBIDA", unit: "UNIDADE", unitCost: 9.50 },
  { name: "Refrigerante lata (insumo)",category: "BEBIDA", unit: "UNIDADE", unitCost: 4.50 },
  { name: "Água mineral (insumo)",   category: "BEBIDA", unit: "UNIDADE", unitCost: 2.00 },
  { name: "Suco (insumo)",           category: "BEBIDA", unit: "UNIDADE", unitCost: 5.00 },
];

async function seedIngredients() {
  for (const i of INGREDIENTS) {
    // NUNCA sobrescrever dados reais: o seed roda a cada deploy (entrypoint)
    // e os custos/preços de produção são a fonte da verdade, não este arquivo.
    await prisma.ingredient.upsert({
      where: { name: i.name },
      update: {},
      create: {
        name: i.name,
        category: i.category,
        unit: i.unit,
        unitCost: i.unitCost,
        supplier: i.supplier,
        lastPriceAt: new Date(),
      },
    });
  }
  console.log(`✓ ${INGREDIENTS.length} ingredientes`);
}

// ============================================================
// 4. PRODUTOS
// ============================================================
type ProductSeed = {
  name: string;
  category: ProductCategory;
  type: ProductType;
  portionLabel: string;
  salePrice?: number;
  targetCmv?: number;
  status?: ProductStatus;
};

const PRODUCTS: ProductSeed[] = [
  // FRANGO
  { name: "Frango Assado Inteiro",       category: "FRANGO", type: "CARNE_PURA", portionLabel: "1 unidade (~2,2kg)", salePrice: 54.90, targetCmv: 0.50 },
  { name: "Coxa e Sobrecoxa — 2 un.",    category: "FRANGO", type: "CARNE_PURA", portionLabel: "2 unidades (~500g)",  salePrice: 24.90, targetCmv: 0.50 },
  { name: "Coxa e Sobrecoxa — 4 un.",    category: "FRANGO", type: "CARNE_PURA", portionLabel: "4 unidades (~1kg)",   salePrice: 44.90, targetCmv: 0.50 },
  { name: "Coxa e Sobrecoxa — 6 un.",    category: "FRANGO", type: "CARNE_PURA", portionLabel: "6 unidades (~1,5kg)", salePrice: 64.90, targetCmv: 0.50 },

  // COSTELA
  { name: "Costela 500g",                category: "COSTELA", type: "CARNE_PURA", portionLabel: "500g pós-assado",   salePrice: 79.90,  targetCmv: 0.50 },
  { name: "Costela 1kg",                 category: "COSTELA", type: "CARNE_PURA", portionLabel: "1kg pós-assado",    salePrice: 139.90, targetCmv: 0.50 },
  { name: "Costela 1,5kg",               category: "COSTELA", type: "CARNE_PURA", portionLabel: "1,5kg pós-assado",  salePrice: 199.90, targetCmv: 0.50 },

  // ACOMPANHAMENTOS
  { name: "Arroz",                       category: "ACOMPANHAMENTOS", type: "ACOMPANHAMENTO", portionLabel: "1 porção (~150g)", salePrice: 4.90,  targetCmv: 0.35 },
  { name: "Macarrão",                    category: "ACOMPANHAMENTOS", type: "ACOMPANHAMENTO", portionLabel: "1 porção (~150g)", salePrice: 5.90,  targetCmv: 0.35 },
  { name: "Mandioca amanteigada com alho", category: "ACOMPANHAMENTOS", type: "ACOMPANHAMENTO", portionLabel: "1 porção (~150g)", salePrice: 6.90, targetCmv: 0.35 },
  { name: "Batata rústica",              category: "ACOMPANHAMENTOS", type: "ACOMPANHAMENTO", portionLabel: "1 porção (~150g)", salePrice: 6.90,  targetCmv: 0.35 },
  { name: "Farofa da casa",              category: "ACOMPANHAMENTOS", type: "ACOMPANHAMENTO", portionLabel: "1 porção (~80g)",  salePrice: 5.90,  targetCmv: 0.35 },
  { name: "Maionese 250g",               category: "ACOMPANHAMENTOS", type: "ACOMPANHAMENTO", portionLabel: "Pote 250g",        salePrice: 12.90, targetCmv: 0.35 },
  { name: "Maionese 500g",               category: "ACOMPANHAMENTOS", type: "ACOMPANHAMENTO", portionLabel: "Pote 500g",        salePrice: 22.90, targetCmv: 0.35 },
  { name: "Vinagrete 250g",              category: "ACOMPANHAMENTOS", type: "ACOMPANHAMENTO", portionLabel: "Pote 250g",        salePrice: 8.90,  targetCmv: 0.35 },
  { name: "Vinagrete 500g",              category: "ACOMPANHAMENTOS", type: "ACOMPANHAMENTO", portionLabel: "Pote 500g",        salePrice: 14.90, targetCmv: 0.35 },

  // SUÍNOS (todos sob encomenda inicialmente)
  { name: "Costelinha BBQ 500g",         category: "SUINOS", type: "CARNE_PURA", portionLabel: "500g pós-assado",   salePrice: 49.90,  targetCmv: 0.50, status: "SOB_ENCOMENDA" },
  { name: "Costelinha BBQ 1kg",          category: "SUINOS", type: "CARNE_PURA", portionLabel: "1kg pós-assado",    salePrice: 89.90,  targetCmv: 0.50, status: "SOB_ENCOMENDA" },
  { name: "Costelinha BBQ 1,5kg",        category: "SUINOS", type: "CARNE_PURA", portionLabel: "1,5kg pós-assado",  salePrice: 129.90, targetCmv: 0.50, status: "SOB_ENCOMENDA" },
  { name: "Panceta 500g",                category: "SUINOS", type: "CARNE_PURA", portionLabel: "500g pós-assado",   salePrice: 54.90,  targetCmv: 0.50, status: "SOB_ENCOMENDA" },
  { name: "Panceta 1kg",                 category: "SUINOS", type: "CARNE_PURA", portionLabel: "1kg pós-assado",    salePrice: 99.90,  targetCmv: 0.50, status: "SOB_ENCOMENDA" },
  { name: "Panceta 1,5kg",               category: "SUINOS", type: "CARNE_PURA", portionLabel: "1,5kg pós-assado",  salePrice: 139.90, targetCmv: 0.50, status: "SOB_ENCOMENDA" },
  { name: "Joelho de Porco Assado",      category: "SUINOS", type: "CARNE_PURA", portionLabel: "1 unidade (~1kg)",  salePrice: 59.90,  targetCmv: 0.50, status: "SOB_ENCOMENDA" },
  { name: "Lombo Assado",                category: "SUINOS", type: "CARNE_PURA", portionLabel: "1kg pós-assado",    salePrice: 89.90,  targetCmv: 0.50, status: "SOB_ENCOMENDA" },
  { name: "Pernil Assado",               category: "SUINOS", type: "CARNE_PURA", portionLabel: "1kg pós-assado",    salePrice: 79.90,  targetCmv: 0.50, status: "SOB_ENCOMENDA" },

  // EXTRAS
  { name: "Molho de pimenta",            category: "EXTRAS", type: "EXTRA", portionLabel: "Pote pequeno",  salePrice: 4.90,  targetCmv: 0.35 },
  { name: "Molho barbecue extra",        category: "EXTRAS", type: "EXTRA", portionLabel: "Pote pequeno",  salePrice: 5.90,  targetCmv: 0.35 },
  { name: "Molho da casa",               category: "EXTRAS", type: "EXTRA", portionLabel: "Pote pequeno",  salePrice: 5.90,  targetCmv: 0.35 },
  { name: "Conserva da casa",            category: "EXTRAS", type: "EXTRA", portionLabel: "Pote 250g",     salePrice: 7.90,  targetCmv: 0.35 },

  // BEBIDAS
  { name: "Refrigerante 2L",             category: "BEBIDAS", type: "BEBIDA", portionLabel: "2 litros", salePrice: 14.90, targetCmv: 0.70 },
  { name: "Refrigerante lata",           category: "BEBIDAS", type: "BEBIDA", portionLabel: "350ml",    salePrice: 6.90,  targetCmv: 0.70 },
  { name: "Água mineral",                category: "BEBIDAS", type: "BEBIDA", portionLabel: "500ml",    salePrice: 3.90,  targetCmv: 0.70 },
  { name: "Suco",                        category: "BEBIDAS", type: "BEBIDA", portionLabel: "300ml",    salePrice: 7.90,  targetCmv: 0.70 },
];

async function seedProducts() {
  for (const p of PRODUCTS) {
    // Só cria se não existir — preços em produção são geridos pelo Bruno.
    await prisma.product.upsert({
      where: { name: p.name },
      update: {},
      create: {
        name: p.name,
        category: p.category,
        type: p.type,
        portionLabel: p.portionLabel,
        salePrice: p.salePrice,
        targetCmv: p.targetCmv,
        status: p.status ?? "ATIVO",
      },
    });
  }
  console.log(`✓ ${PRODUCTS.length} produtos`);
}

// ============================================================
// 5. FICHAS TÉCNICAS
// ============================================================
type RecipeSeed = {
  product: string;
  items: { ingredient: string; quantity: number; unit: IngredientUnit }[];
};

const RECIPES: RecipeSeed[] = [
  // FRANGO
  {
    product: "Frango Assado Inteiro",
    items: [
      { ingredient: "Frango inteiro",            quantity: 2.20, unit: "KG" },
      { ingredient: "Tempero da casa",           quantity: 1,    unit: "PORCAO" },
      { ingredient: "Embalagem frango inteiro",  quantity: 1,    unit: "UNIDADE" },
      { ingredient: "Rateio gás e perdas",       quantity: 1,    unit: "PORCAO" },
    ],
  },
  {
    product: "Coxa e Sobrecoxa — 2 un.",
    items: [
      { ingredient: "Coxa e sobrecoxa",          quantity: 0.50, unit: "KG" },
      { ingredient: "Tempero da casa",           quantity: 0.5,  unit: "PORCAO" },
      { ingredient: "Embalagem coxa/sobrecoxa",  quantity: 1,    unit: "UNIDADE" },
      { ingredient: "Rateio gás e perdas",       quantity: 0.5,  unit: "PORCAO" },
    ],
  },
  {
    product: "Coxa e Sobrecoxa — 4 un.",
    items: [
      { ingredient: "Coxa e sobrecoxa",          quantity: 1.00, unit: "KG" },
      { ingredient: "Tempero da casa",           quantity: 1,    unit: "PORCAO" },
      { ingredient: "Embalagem coxa/sobrecoxa",  quantity: 1,    unit: "UNIDADE" },
      { ingredient: "Rateio gás e perdas",       quantity: 1,    unit: "PORCAO" },
    ],
  },
  {
    product: "Coxa e Sobrecoxa — 6 un.",
    items: [
      { ingredient: "Coxa e sobrecoxa",          quantity: 1.50, unit: "KG" },
      { ingredient: "Tempero da casa",           quantity: 1.5,  unit: "PORCAO" },
      { ingredient: "Embalagem coxa/sobrecoxa",  quantity: 1,    unit: "UNIDADE" },
      { ingredient: "Rateio gás e perdas",       quantity: 1.5,  unit: "PORCAO" },
    ],
  },

  // COSTELA (assume ~35% perda → multiplicador 1.54)
  {
    product: "Costela 500g",
    items: [
      { ingredient: "Costela bovina",            quantity: 0.77, unit: "KG" },
      { ingredient: "Tempero da casa",           quantity: 1,    unit: "PORCAO" },
      { ingredient: "Embalagem costela",         quantity: 1,    unit: "UNIDADE" },
      { ingredient: "Rateio gás e perdas",       quantity: 1,    unit: "PORCAO" },
    ],
  },
  {
    product: "Costela 1kg",
    items: [
      { ingredient: "Costela bovina",            quantity: 1.54, unit: "KG" },
      { ingredient: "Tempero da casa",           quantity: 1.5,  unit: "PORCAO" },
      { ingredient: "Embalagem costela",         quantity: 1,    unit: "UNIDADE" },
      { ingredient: "Rateio gás e perdas",       quantity: 1.5,  unit: "PORCAO" },
    ],
  },
  {
    product: "Costela 1,5kg",
    items: [
      { ingredient: "Costela bovina",            quantity: 2.31, unit: "KG" },
      { ingredient: "Tempero da casa",           quantity: 2,    unit: "PORCAO" },
      { ingredient: "Embalagem costela",         quantity: 1,    unit: "UNIDADE" },
      { ingredient: "Rateio gás e perdas",       quantity: 2,    unit: "PORCAO" },
    ],
  },

  // ACOMPANHAMENTOS (por porção)
  {
    product: "Arroz",
    items: [
      { ingredient: "Arroz",          quantity: 60, unit: "G" },
      { ingredient: "Óleo",           quantity: 5,  unit: "ML" },
      { ingredient: "Alho",           quantity: 3,  unit: "G" },
      { ingredient: "Cebola",         quantity: 8,  unit: "G" },
      { ingredient: "Sal refinado",   quantity: 1,  unit: "G" },
    ],
  },
  {
    product: "Macarrão",
    items: [
      { ingredient: "Macarrão",        quantity: 60, unit: "G" },
      { ingredient: "Molho de tomate", quantity: 30, unit: "ML" },
      { ingredient: "Óleo",            quantity: 3,  unit: "ML" },
      { ingredient: "Sal refinado",    quantity: 1,  unit: "G" },
    ],
  },
  {
    product: "Mandioca amanteigada com alho",
    items: [
      { ingredient: "Mandioca",            quantity: 100, unit: "G" },
      { ingredient: "Manteiga/margarina",  quantity: 8,   unit: "G" },
      { ingredient: "Alho",                quantity: 5,   unit: "G" },
      { ingredient: "Sal refinado",        quantity: 1,   unit: "G" },
      { ingredient: "Óleo",                quantity: 3,   unit: "ML" },
    ],
  },
  {
    product: "Batata rústica",
    items: [
      { ingredient: "Batata",              quantity: 120, unit: "G" },
      { ingredient: "Óleo",                quantity: 10,  unit: "ML" },
      { ingredient: "Sal refinado",        quantity: 1,   unit: "G" },
      { ingredient: "Páprica defumada",    quantity: 1,   unit: "G" },
      { ingredient: "Alho",                quantity: 3,   unit: "G" },
    ],
  },
  {
    product: "Farofa da casa",
    items: [
      { ingredient: "Farinha de mandioca/biju", quantity: 50, unit: "G" },
      { ingredient: "Bacon",                    quantity: 10, unit: "G" },
      { ingredient: "Calabresa",                quantity: 10, unit: "G" },
      { ingredient: "Cebola",                   quantity: 8,  unit: "G" },
      { ingredient: "Manteiga/margarina",       quantity: 5,  unit: "G" },
      { ingredient: "Sal refinado",             quantity: 0.5,unit: "G" },
    ],
  },
  {
    product: "Maionese 250g",
    items: [
      { ingredient: "Batata",              quantity: 100, unit: "G" },
      { ingredient: "Cenoura",             quantity: 30,  unit: "G" },
      { ingredient: "Milho",               quantity: 20,  unit: "G" },
      { ingredient: "Ervilha",             quantity: 20,  unit: "G" },
      { ingredient: "Maionese industrial", quantity: 80,  unit: "G" },
      { ingredient: "Ovos",                quantity: 0.5, unit: "UNIDADE" },
      { ingredient: "Sal refinado",        quantity: 0.5, unit: "G" },
      { ingredient: "Pote 250g",           quantity: 1,   unit: "UNIDADE" },
      { ingredient: "Etiqueta/lacre",      quantity: 1,   unit: "UNIDADE" },
    ],
  },
  {
    product: "Maionese 500g",
    items: [
      { ingredient: "Batata",              quantity: 200, unit: "G" },
      { ingredient: "Cenoura",             quantity: 60,  unit: "G" },
      { ingredient: "Milho",               quantity: 40,  unit: "G" },
      { ingredient: "Ervilha",             quantity: 40,  unit: "G" },
      { ingredient: "Maionese industrial", quantity: 160, unit: "G" },
      { ingredient: "Ovos",                quantity: 1,   unit: "UNIDADE" },
      { ingredient: "Sal refinado",        quantity: 1,   unit: "G" },
      { ingredient: "Pote 500g",           quantity: 1,   unit: "UNIDADE" },
      { ingredient: "Etiqueta/lacre",      quantity: 1,   unit: "UNIDADE" },
    ],
  },
  {
    product: "Vinagrete 250g",
    items: [
      { ingredient: "Tomate",          quantity: 100, unit: "G" },
      { ingredient: "Cebola",          quantity: 50,  unit: "G" },
      { ingredient: "Pimentão",        quantity: 30,  unit: "G" },
      { ingredient: "Cheiro-verde",    quantity: 5,   unit: "G" },
      { ingredient: "Vinagre",         quantity: 30,  unit: "ML" },
      { ingredient: "Óleo",            quantity: 15,  unit: "ML" },
      { ingredient: "Sal refinado",    quantity: 1,   unit: "G" },
      { ingredient: "Pote 250g",       quantity: 1,   unit: "UNIDADE" },
      { ingredient: "Etiqueta/lacre",  quantity: 1,   unit: "UNIDADE" },
    ],
  },
  {
    product: "Vinagrete 500g",
    items: [
      { ingredient: "Tomate",          quantity: 200, unit: "G" },
      { ingredient: "Cebola",          quantity: 100, unit: "G" },
      { ingredient: "Pimentão",        quantity: 60,  unit: "G" },
      { ingredient: "Cheiro-verde",    quantity: 10,  unit: "G" },
      { ingredient: "Vinagre",         quantity: 60,  unit: "ML" },
      { ingredient: "Óleo",            quantity: 30,  unit: "ML" },
      { ingredient: "Sal refinado",    quantity: 2,   unit: "G" },
      { ingredient: "Pote 500g",       quantity: 1,   unit: "UNIDADE" },
      { ingredient: "Etiqueta/lacre",  quantity: 1,   unit: "UNIDADE" },
    ],
  },

  // SUÍNOS (perda 30%)
  {
    product: "Costelinha BBQ 500g",
    items: [
      { ingredient: "Costelinha suína",     quantity: 0.715, unit: "KG" },
      { ingredient: "Tempero da casa",      quantity: 1,     unit: "PORCAO" },
      { ingredient: "Molho barbecue pronto",quantity: 30,    unit: "ML" },
      { ingredient: "Embalagem costela",    quantity: 1,     unit: "UNIDADE" },
      { ingredient: "Rateio gás e perdas",  quantity: 1,     unit: "PORCAO" },
    ],
  },
  {
    product: "Costelinha BBQ 1kg",
    items: [
      { ingredient: "Costelinha suína",     quantity: 1.43, unit: "KG" },
      { ingredient: "Tempero da casa",      quantity: 1.5,  unit: "PORCAO" },
      { ingredient: "Molho barbecue pronto",quantity: 60,   unit: "ML" },
      { ingredient: "Embalagem costela",    quantity: 1,    unit: "UNIDADE" },
      { ingredient: "Rateio gás e perdas",  quantity: 1.5,  unit: "PORCAO" },
    ],
  },
  {
    product: "Costelinha BBQ 1,5kg",
    items: [
      { ingredient: "Costelinha suína",     quantity: 2.14, unit: "KG" },
      { ingredient: "Tempero da casa",      quantity: 2,    unit: "PORCAO" },
      { ingredient: "Molho barbecue pronto",quantity: 100,  unit: "ML" },
      { ingredient: "Embalagem costela",    quantity: 1,    unit: "UNIDADE" },
      { ingredient: "Rateio gás e perdas",  quantity: 2,    unit: "PORCAO" },
    ],
  },
  {
    product: "Panceta 500g",
    items: [
      { ingredient: "Panceta/barriga de porco", quantity: 0.715, unit: "KG" },
      { ingredient: "Tempero da casa",          quantity: 1,     unit: "PORCAO" },
      { ingredient: "Embalagem costela",        quantity: 1,     unit: "UNIDADE" },
      { ingredient: "Rateio gás e perdas",      quantity: 1,     unit: "PORCAO" },
    ],
  },
  {
    product: "Panceta 1kg",
    items: [
      { ingredient: "Panceta/barriga de porco", quantity: 1.43, unit: "KG" },
      { ingredient: "Tempero da casa",          quantity: 1.5,  unit: "PORCAO" },
      { ingredient: "Embalagem costela",        quantity: 1,    unit: "UNIDADE" },
      { ingredient: "Rateio gás e perdas",      quantity: 1.5,  unit: "PORCAO" },
    ],
  },
  {
    product: "Panceta 1,5kg",
    items: [
      { ingredient: "Panceta/barriga de porco", quantity: 2.14, unit: "KG" },
      { ingredient: "Tempero da casa",          quantity: 2,    unit: "PORCAO" },
      { ingredient: "Embalagem costela",        quantity: 1,    unit: "UNIDADE" },
      { ingredient: "Rateio gás e perdas",      quantity: 2,    unit: "PORCAO" },
    ],
  },
  {
    product: "Joelho de Porco Assado",
    items: [
      { ingredient: "Joelho de porco",      quantity: 1,    unit: "UNIDADE" },
      { ingredient: "Tempero da casa",      quantity: 1,    unit: "PORCAO" },
      { ingredient: "Embalagem costela",    quantity: 1,    unit: "UNIDADE" },
      { ingredient: "Rateio gás e perdas",  quantity: 1.5,  unit: "PORCAO" },
    ],
  },
  {
    product: "Lombo Assado",
    items: [
      { ingredient: "Lombo suíno",          quantity: 1.33, unit: "KG" },
      { ingredient: "Tempero da casa",      quantity: 1.5,  unit: "PORCAO" },
      { ingredient: "Embalagem costela",    quantity: 1,    unit: "UNIDADE" },
      { ingredient: "Rateio gás e perdas",  quantity: 1.5,  unit: "PORCAO" },
    ],
  },
  {
    product: "Pernil Assado",
    items: [
      { ingredient: "Pernil suíno",         quantity: 1.33, unit: "KG" },
      { ingredient: "Tempero da casa",      quantity: 1.5,  unit: "PORCAO" },
      { ingredient: "Embalagem costela",    quantity: 1,    unit: "UNIDADE" },
      { ingredient: "Rateio gás e perdas",  quantity: 1.5,  unit: "PORCAO" },
    ],
  },

  // EXTRAS (molhos)
  {
    product: "Molho de pimenta",
    items: [
      { ingredient: "Pote molho pequeno", quantity: 1,   unit: "UNIDADE" },
      { ingredient: "Pimenta-do-reino",   quantity: 5,   unit: "G" },
      { ingredient: "Vinagre",            quantity: 20,  unit: "ML" },
      { ingredient: "Óleo",               quantity: 5,   unit: "ML" },
      { ingredient: "Sal refinado",       quantity: 0.3, unit: "G" },
    ],
  },
  {
    product: "Molho barbecue extra",
    items: [
      { ingredient: "Pote molho pequeno",   quantity: 1,  unit: "UNIDADE" },
      { ingredient: "Molho barbecue pronto",quantity: 80, unit: "ML" },
    ],
  },
  {
    product: "Molho da casa",
    items: [
      { ingredient: "Pote molho pequeno",  quantity: 1,   unit: "UNIDADE" },
      { ingredient: "Maionese industrial", quantity: 50,  unit: "G" },
      { ingredient: "Mostarda",            quantity: 20,  unit: "ML" },
      { ingredient: "Mel",                 quantity: 10,  unit: "ML" },
      { ingredient: "Limão",               quantity: 0.2, unit: "UNIDADE" },
    ],
  },
  {
    product: "Conserva da casa",
    items: [
      { ingredient: "Pote 250g",       quantity: 1,  unit: "UNIDADE" },
      { ingredient: "Cebola",          quantity: 50, unit: "G" },
      { ingredient: "Vinagre",         quantity: 60, unit: "ML" },
      { ingredient: "Pimentão",        quantity: 30, unit: "G" },
      { ingredient: "Sal refinado",    quantity: 1,  unit: "G" },
      { ingredient: "Açúcar mascavo",  quantity: 5,  unit: "G" },
    ],
  },

  // BEBIDAS (revenda — só o insumo)
  {
    product: "Refrigerante 2L",
    items: [{ ingredient: "Refrigerante 2L (insumo)", quantity: 1, unit: "UNIDADE" }],
  },
  {
    product: "Refrigerante lata",
    items: [{ ingredient: "Refrigerante lata (insumo)", quantity: 1, unit: "UNIDADE" }],
  },
  {
    product: "Água mineral",
    items: [{ ingredient: "Água mineral (insumo)", quantity: 1, unit: "UNIDADE" }],
  },
  {
    product: "Suco",
    items: [{ ingredient: "Suco (insumo)", quantity: 1, unit: "UNIDADE" }],
  },
];

async function seedRecipes() {
  for (const r of RECIPES) {
    const product = await prisma.product.findUnique({ where: { name: r.product } });
    if (!product) continue;

    // Ficha já existe → NÃO tocar (custos reais vivem no banco, não aqui).
    const existing = await prisma.recipe.findUnique({
      where: { productId: product.id },
      select: { id: true },
    });
    if (existing) continue;

    const recipe = await prisma.recipe.create({ data: { productId: product.id } });

    let recipeTotal = 0;
    for (const item of r.items) {
      const ing = await prisma.ingredient.findUnique({ where: { name: item.ingredient } });
      if (!ing) {
        console.warn(`  ! Ingrediente não encontrado: ${item.ingredient} (em ${r.product})`);
        continue;
      }
      const unitCost = Number(ing.unitCost);
      const totalCost = unitCost * item.quantity;
      recipeTotal += totalCost;

      await prisma.recipeItem.create({
        data: {
          recipeId: recipe.id,
          ingredientId: ing.id,
          quantity: item.quantity,
          unit: item.unit,
          unitCostSnapshot: unitCost,
          totalCost,
        },
      });
    }

    await prisma.recipe.update({
      where: { id: recipe.id },
      data: { totalCost: recipeTotal },
    });
    await prisma.product.update({
      where: { id: product.id },
      data: { totalCost: recipeTotal },
    });
  }
  console.log(`✓ ${RECIPES.length} fichas técnicas`);
}

// ============================================================
// 6. COMBOS
// ============================================================
type ComboSeed = {
  name: string;
  category: ProductCategory;
  salePrice: number;
  items: { product: string; quantity: number }[];
};

const COMBOS: ComboSeed[] = [
  {
    name: "Combo Frango Simples",
    category: "FRANGO",
    salePrice: 64.90,
    items: [
      { product: "Frango Assado Inteiro", quantity: 1 },
      { product: "Farofa da casa",        quantity: 1.5 },
    ],
  },
  {
    name: "Combo Frango Família",
    category: "FRANGO",
    salePrice: 84.90,
    items: [
      { product: "Frango Assado Inteiro",            quantity: 1 },
      { product: "Arroz",                            quantity: 7 },
      { product: "Mandioca amanteigada com alho",    quantity: 5 },
      { product: "Farofa da casa",                   quantity: 1.5 },
    ],
  },
  {
    name: "Combo Frango Domingão",
    category: "FRANGO",
    salePrice: 99.90,
    items: [
      { product: "Frango Assado Inteiro",            quantity: 1 },
      { product: "Arroz",                            quantity: 8.5 },
      { product: "Mandioca amanteigada com alho",    quantity: 6.5 },
      { product: "Farofa da casa",                   quantity: 2 },
      { product: "Maionese 250g",                    quantity: 1 },
    ],
  },
  {
    name: "Combo Frango Duplo",
    category: "FRANGO",
    salePrice: 169.90,
    items: [
      { product: "Frango Assado Inteiro",            quantity: 2 },
      { product: "Arroz",                            quantity: 12 },
      { product: "Mandioca amanteigada com alho",    quantity: 10 },
      { product: "Farofa da casa",                   quantity: 3 },
      { product: "Maionese 500g",                    quantity: 1 },
    ],
  },
  {
    name: "Combo Coxa Individual",
    category: "FRANGO",
    salePrice: 29.90,
    items: [
      { product: "Coxa e Sobrecoxa — 2 un.",         quantity: 1 },
      { product: "Arroz",                            quantity: 2 },
      { product: "Mandioca amanteigada com alho",    quantity: 1.5 },
      { product: "Farofa da casa",                   quantity: 0.5 },
    ],
  },
  {
    name: "Combo Coxa Casal",
    category: "FRANGO",
    salePrice: 49.90,
    items: [
      { product: "Coxa e Sobrecoxa — 4 un.",         quantity: 1 },
      { product: "Arroz",                            quantity: 3.5 },
      { product: "Mandioca amanteigada com alho",    quantity: 2.5 },
      { product: "Farofa da casa",                   quantity: 1 },
    ],
  },
  {
    name: "Combo Coxa Família",
    category: "FRANGO",
    salePrice: 69.90,
    items: [
      { product: "Coxa e Sobrecoxa — 6 un.",         quantity: 1 },
      { product: "Arroz",                            quantity: 5 },
      { product: "Mandioca amanteigada com alho",    quantity: 4 },
      { product: "Farofa da casa",                   quantity: 1.5 },
    ],
  },
  {
    name: "Combo Costela Casal",
    category: "COSTELA",
    salePrice: 99.90,
    items: [
      { product: "Costela 500g",                     quantity: 1 },
      { product: "Arroz",                            quantity: 3.5 },
      { product: "Mandioca amanteigada com alho",    quantity: 2.5 },
      { product: "Farofa da casa",                   quantity: 1 },
    ],
  },
  {
    name: "Combo Costela Família",
    category: "COSTELA",
    salePrice: 149.90,
    items: [
      { product: "Costela 1kg",                      quantity: 1 },
      { product: "Arroz",                            quantity: 5 },
      { product: "Mandioca amanteigada com alho",    quantity: 4 },
      { product: "Farofa da casa",                   quantity: 1.5 },
    ],
  },
  {
    name: "Combo Costela Domingão",
    category: "COSTELA",
    salePrice: 199.90,
    items: [
      { product: "Costela 1,5kg",                    quantity: 1 },
      { product: "Arroz",                            quantity: 8.5 },
      { product: "Mandioca amanteigada com alho",    quantity: 6.5 },
      { product: "Farofa da casa",                   quantity: 2 },
    ],
  },
  {
    name: "Combo Costelinha Casal",
    category: "SUINOS",
    salePrice: 59.90,
    items: [
      { product: "Costelinha BBQ 500g",              quantity: 1 },
      { product: "Arroz",                            quantity: 3.5 },
      { product: "Mandioca amanteigada com alho",    quantity: 2.5 },
      { product: "Farofa da casa",                   quantity: 1 },
    ],
  },
  {
    name: "Combo Costelinha Família",
    category: "SUINOS",
    salePrice: 99.90,
    items: [
      { product: "Costelinha BBQ 1kg",               quantity: 1 },
      { product: "Arroz",                            quantity: 5 },
      { product: "Mandioca amanteigada com alho",    quantity: 4 },
      { product: "Farofa da casa",                   quantity: 1.5 },
    ],
  },
  {
    name: "Combo Costelinha Domingão",
    category: "SUINOS",
    salePrice: 139.90,
    items: [
      { product: "Costelinha BBQ 1,5kg",             quantity: 1 },
      { product: "Arroz",                            quantity: 8.5 },
      { product: "Mandioca amanteigada com alho",    quantity: 6.5 },
      { product: "Farofa da casa",                   quantity: 2 },
    ],
  },
  {
    name: "Combo Panceta Casal",
    category: "SUINOS",
    salePrice: 64.90,
    items: [
      { product: "Panceta 500g",                     quantity: 1 },
      { product: "Arroz",                            quantity: 3.5 },
      { product: "Mandioca amanteigada com alho",    quantity: 2.5 },
      { product: "Farofa da casa",                   quantity: 1 },
    ],
  },
  {
    name: "Combo Panceta Família",
    category: "SUINOS",
    salePrice: 109.90,
    items: [
      { product: "Panceta 1kg",                      quantity: 1 },
      { product: "Arroz",                            quantity: 5 },
      { product: "Mandioca amanteigada com alho",    quantity: 4 },
      { product: "Farofa da casa",                   quantity: 1.5 },
    ],
  },
  {
    name: "Combo Panceta Domingão",
    category: "SUINOS",
    salePrice: 149.90,
    items: [
      { product: "Panceta 1,5kg",                    quantity: 1 },
      { product: "Arroz",                            quantity: 8.5 },
      { product: "Mandioca amanteigada com alho",    quantity: 6.5 },
      { product: "Farofa da casa",                   quantity: 2 },
    ],
  },
];

async function seedCombos() {
  for (const c of COMBOS) {
    // Combo já existe → NÃO tocar (preço/composição geridos em produção).
    const already = await prisma.combo.findUnique({
      where: { name: c.name },
      select: { id: true },
    });
    if (already) continue;

    const combo = await prisma.combo.create({
      data: {
        name: c.name,
        category: c.category,
        salePrice: c.salePrice,
        targetCmv: 0.45,
        active: true,
      },
    });

    let total = 0;
    for (const item of c.items) {
      const product = await prisma.product.findUnique({ where: { name: item.product } });
      if (!product) {
        console.warn(`  ! Produto não encontrado no combo ${c.name}: ${item.product}`);
        continue;
      }
      const unitCost = Number(product.totalCost);
      const totalCost = unitCost * item.quantity;
      total += totalCost;

      await prisma.comboItem.create({
        data: {
          comboId: combo.id,
          productId: product.id,
          quantity: item.quantity,
          unitCostSnapshot: unitCost,
          totalCost,
        },
      });
    }

    await prisma.combo.update({
      where: { id: combo.id },
      data: { totalCost: total },
    });
  }
  console.log(`✓ ${COMBOS.length} combos`);
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log("→ Seed Casa Roxa\n");
  await seedAdmin();
  await seedSettings();
  await seedIngredients();
  await seedProducts();
  await seedRecipes();
  await seedCombos();
  console.log("\n✔ Seed concluído");
}

main()
  .catch((e) => {
    console.error("✖ Seed falhou:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
