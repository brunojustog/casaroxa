"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import {
  USER_ROLES,
  userCreateSchema,
  userUpdateSchema,
  type UserCreateData,
  type UserUpdateData,
} from "@/schemas/user.schema";
import {
  createUserAction,
  updateUserAction,
} from "@/server/actions/users";
import type { UserRole } from "@prisma/client";

type Mode = { type: "create" } | { type: "edit"; id: string; isSelf: boolean };

export type UserFormDefaults = Partial<{
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}>;

const ROLE_LABEL: Record<(typeof USER_ROLES)[number], string> = {
  ADMIN: "Administrador (acesso total)",
  OPERADOR: "Operador (vendas, estoque, dashboard, assistente)",
};

export function UserForm({
  mode,
  defaultValues,
}: {
  mode: Mode;
  defaultValues?: UserFormDefaults;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const isEdit = mode.type === "edit";
  const schema = isEdit ? userUpdateSchema : userCreateSchema;

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      email: defaultValues?.email ?? "",
      role: defaultValues?.role ?? ("OPERADOR" as UserRole),
      password: "",
      active: defaultValues?.active ?? true,
    } as unknown as UserCreateData,
  });

  const errors = form.formState.errors;

  function onSubmit(values: UserCreateData | UserUpdateData) {
    setServerError(null);
    startTransition(async () => {
      const res = isEdit
        ? await updateUserAction(mode.id, values)
        : await createUserAction(values);
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      router.push("/usuarios");
      router.refresh();
    });
  }

  const isSelf = mode.type === "edit" && mode.isSelf;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nome" required error={errors.name?.message}>
          <Input {...form.register("name")} placeholder="Ex.: Maria Silva" />
        </Field>
        <Field label="E-mail" required error={errors.email?.message}>
          <Input
            type="email"
            autoComplete="off"
            {...form.register("email")}
            placeholder="maria@casaroxa.com.br"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Perfil"
          required
          error={errors.role?.message}
          hint={
            isSelf
              ? "Você não pode rebaixar seu próprio perfil."
              : "ADMIN vê tudo. OPERADOR só vendas, estoque, dashboard e assistente."
          }
        >
          <Select {...form.register("role")} disabled={isSelf}>
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label={isEdit ? "Nova senha (opcional)" : "Senha"}
          required={!isEdit}
          error={errors.password?.message}
          hint={
            isEdit
              ? "Deixe em branco pra manter a senha atual. Mínimo 8 caracteres."
              : "Mínimo 8 caracteres."
          }
        >
          <Input
            type="password"
            autoComplete="new-password"
            {...form.register("password")}
            placeholder={isEdit ? "••••••••" : ""}
          />
        </Field>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="active"
          {...form.register("active")}
          disabled={isSelf}
        />
        <label htmlFor="active" className="text-sm text-slate-700">
          Usuário ativo {isSelf && <span className="text-slate-400">(você não pode desativar a si mesmo)</span>}
        </label>
      </div>

      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
        <Link
          href="/usuarios"
          className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </Link>
        <Button type="submit" disabled={isPending}>
          <Save className="h-4 w-4" />
          {isPending ? "Salvando…" : isEdit ? "Salvar" : "Criar usuário"}
        </Button>
      </div>
    </form>
  );
}
