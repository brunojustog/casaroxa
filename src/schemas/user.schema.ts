import { z } from "zod";

export const USER_ROLES = ["ADMIN", "OPERADOR"] as const;

/** Form de criação: senha obrigatória. */
export const userCreateSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(160),
  role: z.enum(USER_ROLES),
  password: z
    .string()
    .min(8, "Senha precisa ter pelo menos 8 caracteres")
    .max(120),
  active: z.coerce.boolean().default(true),
});

/** Form de edição: senha opcional (só troca se preenchida). */
export const userUpdateSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(160),
  role: z.enum(USER_ROLES),
  password: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine(
      (v) => v === null || v.length >= 8,
      "Senha precisa ter pelo menos 8 caracteres",
    ),
  active: z.coerce.boolean().default(true),
});

export type UserCreateInput = z.input<typeof userCreateSchema>;
export type UserCreateData = z.output<typeof userCreateSchema>;
export type UserUpdateInput = z.input<typeof userUpdateSchema>;
export type UserUpdateData = z.output<typeof userUpdateSchema>;

export const userListFiltersSchema = z.object({
  search: z.string().trim().optional(),
  active: z.enum(["all", "active", "inactive"]).optional().default("all"),
});
export type UserListFilters = z.infer<typeof userListFiltersSchema>;
