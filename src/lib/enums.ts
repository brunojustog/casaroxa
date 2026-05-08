/**
 * Labels PT-BR para os enums do Prisma.
 * Centralizado para que mudanças sejam pontuais.
 */
import {
  FixedCostCategory,
  FixedCostFrequency,
  IngredientCategory,
  IngredientUnit,
  ImportStatus,
  ProductCategory,
  ProductStatus,
  ProductType,
  SimulationTarget,
  UserRole,
} from "@prisma/client";

export const INGREDIENT_CATEGORY_LABEL: Record<IngredientCategory, string> = {
  CARNE: "Carne",
  TEMPERO: "Tempero",
  ACOMPANHAMENTO: "Acompanhamento",
  EMBALAGEM: "Embalagem",
  BEBIDA: "Bebida",
  LIMPEZA: "Limpeza",
  GAS: "Gás",
  OUTRO: "Outro",
};

export const INGREDIENT_UNIT_LABEL: Record<IngredientUnit, string> = {
  KG: "kg",
  G: "g",
  UNIDADE: "un",
  PACOTE: "pacote",
  LITRO: "L",
  ML: "ml",
  PORCAO: "porção",
  BOTIJAO: "botijão",
  CAIXA: "caixa",
};

export const PRODUCT_CATEGORY_LABEL: Record<ProductCategory, string> = {
  FRANGO: "Frango",
  COSTELA: "Costela",
  SUINOS: "Suínos",
  ACOMPANHAMENTOS: "Acompanhamentos",
  EXTRAS: "Extras",
  BEBIDAS: "Bebidas",
};

export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  SIMPLES: "Simples",
  ACOMPANHAMENTO: "Acompanhamento",
  EXTRA: "Extra",
  BEBIDA: "Bebida",
  CARNE_PURA: "Carne pura",
};

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  ATIVO: "Ativo",
  INATIVO: "Inativo",
  SOB_ENCOMENDA: "Sob encomenda",
};

export const SIMULATION_TARGET_LABEL: Record<SimulationTarget, string> = {
  PRODUTO: "Produto",
  COMBO: "Combo",
};

export const IMPORT_STATUS_LABEL: Record<ImportStatus, string> = {
  PENDENTE: "Pendente",
  SUCESSO: "Sucesso",
  PARCIAL: "Parcial",
  FALHA: "Falha",
};

export const FIXED_COST_CATEGORY_LABEL: Record<FixedCostCategory, string> = {
  ALUGUEL: "Aluguel",
  ENERGIA: "Energia",
  AGUA: "Água",
  INTERNET: "Internet / Telefone",
  FOLHA: "Folha de pagamento",
  IMPOSTOS: "Impostos / Taxas",
  CONTADOR: "Contador",
  MARKETING: "Marketing",
  EQUIPAMENTOS: "Equipamentos / Manutenção",
  OUTROS: "Outros",
};

export const FIXED_COST_FREQUENCY_LABEL: Record<FixedCostFrequency, string> = {
  MENSAL: "Mensal",
  ANUAL: "Anual (rateio /12)",
};

export const USER_ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "Administrador",
  OPERADOR: "Operador",
};

export function enumOptions<T extends string>(map: Record<T, string>): { value: T; label: string }[] {
  return Object.entries(map).map(([value, label]) => ({
    value: value as T,
    label: label as string,
  }));
}
