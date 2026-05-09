import { z } from "zod";

const optionalString = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

/** Normaliza telefone: só dígitos. Permite reconhecer o mesmo número
 *  digitado em formatos diferentes ((11) 99999-9999 vs 11999999999). */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D+/g, "");
}

const optionalDate = () =>
  z
    .union([z.string(), z.date()])
    .optional()
    .nullable()
    .transform((v) => {
      if (!v) return null;
      const d = typeof v === "string" ? new Date(v) : v;
      return isNaN(d.getTime()) ? null : d;
    });

export const customerFormSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(120),
  phone: z
    .string()
    .trim()
    .min(8, "Telefone curto demais")
    .max(40, "Telefone longo demais")
    .transform(normalizePhone),
  email: optionalString(160),
  birthday: optionalDate(),
  address: optionalString(300),
  addressNumber: optionalString(40),
  addressComplement: optionalString(120),
  neighborhood: optionalString(120),
  reference: optionalString(200),
  notes: optionalString(2000),
  active: z.coerce.boolean().default(true),
});

export type CustomerFormInput = z.input<typeof customerFormSchema>;
export type CustomerFormData = z.output<typeof customerFormSchema>;

export const customerListFiltersSchema = z.object({
  search: z.string().trim().optional(),
  active: z.enum(["all", "active", "inactive"]).optional().default("active"),
  birthdayMonth: z
    .string()
    .regex(/^(0[1-9]|1[0-2])$/)
    .optional(),
});
export type CustomerListFilters = z.infer<typeof customerListFiltersSchema>;
