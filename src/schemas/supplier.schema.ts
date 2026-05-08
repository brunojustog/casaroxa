import { z } from "zod";

const optionalString = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

export const supplierFormSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(120),
  cnpj: optionalString(20),
  contactPerson: optionalString(120),
  phone: optionalString(40),
  email: optionalString(120),
  notes: optionalString(2000),
  active: z.coerce.boolean().default(true),
});

export type SupplierFormInput = z.input<typeof supplierFormSchema>;
export type SupplierFormData = z.output<typeof supplierFormSchema>;

export const supplierListFiltersSchema = z.object({
  search: z.string().trim().optional(),
  active: z.enum(["all", "active", "inactive"]).optional().default("active"),
});
export type SupplierListFilters = z.infer<typeof supplierListFiltersSchema>;
