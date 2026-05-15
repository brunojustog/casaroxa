"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import {
  enumOptions,
  INGREDIENT_CATEGORY_LABEL,
  INGREDIENT_UNIT_LABEL,
} from "@/lib/enums";
import { formatBRL, formatDate } from "@/lib/format";
import {
  analyzeNfeAction,
  importNfeAction,
} from "@/server/actions/nfe";
import type {
  NfePreview,
} from "@/server/services/nfe-import.service";
import type {
  IngredientCategory,
  IngredientUnit,
} from "@prisma/client";

const CATEGORIES = enumOptions(INGREDIENT_CATEGORY_LABEL);
const UNITS = enumOptions(INGREDIENT_UNIT_LABEL);

type ItemAction = "use_existing" | "create_new" | "skip";

type ItemState = {
  action: ItemAction;
  /** quando use_existing */
  ingredientId: string;
  /** quando create_new */
  newName: string;
  newCategory: IngredientCategory;
  newUnit: IngredientUnit;
  /** comum */
  quantity: string;
  unitCost: string;
  lotNumber: string;
  expiryDate: string;
  updateIngredientCost: boolean;
};

type SupplierAction = "use_existing" | "create_new" | "none";

export type AvailableSupplier = { id: string; name: string };
export type AvailableIngredient = {
  id: string;
  name: string;
  category: IngredientCategory;
  unit: IngredientUnit;
};

export function NfeImporter({
  suppliers,
  ingredients,
}: {
  suppliers: AvailableSupplier[];
  ingredients: AvailableIngredient[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<NfePreview | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const [supplierAction, setSupplierAction] = useState<SupplierAction>("none");
  const [supplierId, setSupplierId] = useState<string>("");
  const [newSupplierName, setNewSupplierName] = useState<string>("");
  const [newSupplierCnpj, setNewSupplierCnpj] = useState<string>("");

  const [items, setItems] = useState<ItemState[]>([]);

  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [statusOption, setStatusOption] = useState<"RASCUNHO" | "CONFIRMADA">(
    "RASCUNHO",
  );

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.currentTarget.files?.[0] ?? null;
    setFile(f);
    setPreview(null);
    setServerError(null);
  }

  function analyze() {
    if (!file) {
      setServerError("Selecione um arquivo XML.");
      return;
    }
    setServerError(null);
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const res = await analyzeNfeAction(fd);
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      const p = res.data;
      if (!p) return;
      setPreview(p);

      // Pré-popula UI a partir do preview
      setInvoiceNumber(p.invoiceNumber ?? "");
      setInvoiceDate(
        p.invoiceDate ? p.invoiceDate.toString().slice(0, 10) : "",
      );
      setNotes(`Importação automática de NFe ${p.invoiceNumber ?? ""}`);

      if (p.supplier.matchedSupplierId) {
        setSupplierAction("use_existing");
        setSupplierId(p.supplier.matchedSupplierId);
      } else if (p.supplier.cnpj || p.supplier.name) {
        setSupplierAction("create_new");
        setNewSupplierName(p.supplier.name ?? "");
        setNewSupplierCnpj(p.supplier.cnpj ?? "");
      } else {
        setSupplierAction("none");
      }

      setItems(
        p.items.map((it) => {
          const best = it.bestMatch;
          if (best) {
            return {
              action: "use_existing",
              ingredientId: best.ingredientId,
              newName: it.raw.xProd,
              newCategory: "OUTRO",
              newUnit: it.suggestedUnit,
              quantity: String(it.raw.qCom),
              unitCost: String(it.raw.vUnCom),
              lotNumber: "",
              expiryDate: "",
              updateIngredientCost: true,
            };
          }
          return {
            action: "create_new",
            ingredientId: "",
            newName: it.raw.xProd,
            newCategory: "OUTRO",
            newUnit: it.suggestedUnit,
            quantity: String(it.raw.qCom),
            unitCost: String(it.raw.vUnCom),
            lotNumber: "",
            expiryDate: "",
            updateIngredientCost: true,
          };
        }),
      );
    });
  }

  function updateItem(idx: number, patch: Partial<ItemState>) {
    setItems((prev) => prev.map((i, j) => (j === idx ? { ...i, ...patch } : i)));
  }

  function execute() {
    if (!preview) return;

    const willConfirm = statusOption === "CONFIRMADA";
    const validCount = items.filter((i) => i.action !== "skip").length;
    if (validCount === 0) {
      setServerError("Marque pelo menos 1 item para importar.");
      return;
    }
    const confirmMsg = willConfirm
      ? `Confirmar importação de ${validCount} item(ns) e MARCAR COMO CONFIRMADA? Vai gerar movimentos de estoque + atualizar custos (cascata para fichas/combos).`
      : `Importar ${validCount} item(ns) como rascunho? Você poderá revisar e confirmar depois.`;
    if (!window.confirm(confirmMsg)) return;

    setServerError(null);

    const supplierDecision =
      supplierAction === "use_existing"
        ? { action: "use_existing" as const, supplierId }
        : supplierAction === "create_new"
          ? {
              action: "create_new" as const,
              name: newSupplierName,
              cnpj: newSupplierCnpj || null,
            }
          : { action: "none" as const };

    const itemDecisions = items.map((it, idx) => {
      const previewItem = preview?.items?.[idx];
      if (it.action === "skip") return { action: "skip" as const };
      if (it.action === "use_existing") {
        return {
          action: "use_existing" as const,
          ingredientId: it.ingredientId,
          quantity: it.quantity,
          unitCost: it.unitCost,
          lotNumber: it.lotNumber || null,
          expiryDate: it.expiryDate || null,
          updateIngredientCost: it.updateIngredientCost,
          rawName: previewItem?.raw?.xProd ?? null,
        };
      }
      return {
        action: "create_new" as const,
        newName: it.newName,
        newCategory: it.newCategory,
        newUnit: it.newUnit,
        quantity: it.quantity,
        unitCost: it.unitCost,
        lotNumber: it.lotNumber || null,
        expiryDate: it.expiryDate || null,
      };
    });

    const payload = {
      invoiceNumber: invoiceNumber || null,
      invoiceDate,
      totalAmount: preview.totalAmount,
      notes: notes || null,
      status: statusOption,
      supplier: supplierDecision,
      items: itemDecisions,
    };

    startTransition(async () => {
      const res = await importNfeAction(payload);
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      // server action redireciona em sucesso; fallback caso volte aqui
      router.refresh();
    });
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="space-y-6">
      {/* Step 1 — Upload */}
      <Card>
        <CardHeader>
          <CardTitle>1. Suba o XML da NFe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            type="file"
            accept=".xml,application/xml,text/xml"
            onChange={onFileChange}
            className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-roxa-700 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-roxa-800 file:cursor-pointer"
          />
          {file && (
            <div className="flex items-center gap-2 text-sm text-slate-600 rounded-md bg-slate-50 px-3 py-2 border border-slate-200">
              <FileText className="h-4 w-4 text-slate-500" />
              <span className="font-medium">{file.name}</span>
              <span className="text-xs text-slate-400">
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
            </div>
          )}
          <Button type="button" onClick={analyze} disabled={!file || isPending}>
            <Upload className="h-4 w-4" />
            {isPending && !preview ? "Analisando…" : "Analisar XML"}
          </Button>
        </CardContent>
      </Card>

      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {serverError}
        </div>
      )}

      {preview && (
        <>
          {/* Step 2 — Cabeçalho */}
          <Card>
            <CardHeader>
              <CardTitle>2. Cabeçalho da compra</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Número da NF">
                  <Input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.currentTarget.value)}
                  />
                </Field>
                <Field label="Data da NF" required>
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.currentTarget.value)}
                  />
                </Field>
                <Field label="Total da NF (auto)">
                  <Input value={formatBRL(preview.totalAmount)} disabled />
                </Field>
              </div>

              <Field label="Observações">
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.currentTarget.value)}
                />
              </Field>
            </CardContent>
          </Card>

          {/* Step 3 — Fornecedor */}
          <Card>
            <CardHeader>
              <CardTitle>3. Fornecedor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-slate-500">
                Detectado no XML:{" "}
                <strong>{preview.supplier.name ?? "—"}</strong>
                {preview.supplier.cnpj && ` · CNPJ ${preview.supplier.cnpj}`}
                {preview.supplier.matchedSupplierId && (
                  <Badge tone="success" className="ml-2">
                    casado por {preview.supplier.matchedBy}
                  </Badge>
                )}
              </p>

              <div className="flex flex-wrap gap-3">
                <RadioOption
                  checked={supplierAction === "use_existing"}
                  onChange={() => setSupplierAction("use_existing")}
                  label="Usar fornecedor existente"
                />
                <RadioOption
                  checked={supplierAction === "create_new"}
                  onChange={() => setSupplierAction("create_new")}
                  label="Criar novo fornecedor"
                />
                <RadioOption
                  checked={supplierAction === "none"}
                  onChange={() => setSupplierAction("none")}
                  label="Sem fornecedor"
                />
              </div>

              {supplierAction === "use_existing" && (
                <Field label="Fornecedor cadastrado">
                  <Select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.currentTarget.value)}
                  >
                    <option value="">— escolher —</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}

              {supplierAction === "create_new" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Nome" required>
                    <Input
                      value={newSupplierName}
                      onChange={(e) =>
                        setNewSupplierName(e.currentTarget.value)
                      }
                    />
                  </Field>
                  <Field label="CNPJ">
                    <Input
                      value={newSupplierCnpj}
                      onChange={(e) =>
                        setNewSupplierCnpj(e.currentTarget.value)
                      }
                    />
                  </Field>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 4 — Itens */}
          <Card>
            <CardHeader>
              <CardTitle>4. Itens — confirme o matching</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <THead>
                  <TR>
                    <TH className="w-1/3">Item da NF</TH>
                    <TH>Ação</TH>
                    <TH>Ingrediente / Novo</TH>
                    <TH className="text-right">Qtd</TH>
                    <TH className="text-right">Custo</TH>
                  </TR>
                </THead>
                <TBody>
                  {preview.items.map((preview, idx) => {
                    const state = items[idx];
                    if (!state) return null;
                    return (
                      <TR key={idx}>
                        <TD className="align-top">
                          <p className="font-medium text-slate-900 text-xs">
                            {preview.raw.xProd}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {preview.raw.cProd && `cód. ${preview.raw.cProd}`}
                            {preview.raw.ncm && ` · NCM ${preview.raw.ncm}`}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            uCom: <strong>{preview.raw.uCom}</strong> →{" "}
                            {INGREDIENT_UNIT_LABEL[preview.suggestedUnit]}
                          </p>
                          {preview.bestMatch && (
                            <p className="text-[10px] text-green-700 mt-1">
                              Match: {preview.bestMatch.name} (
                              {(preview.bestMatch.score * 100).toFixed(0)}%)
                            </p>
                          )}
                        </TD>
                        <TD className="align-top">
                          <Select
                            value={state.action}
                            onChange={(e) =>
                              updateItem(idx, {
                                action: e.currentTarget.value as ItemAction,
                              })
                            }
                            className="w-36"
                          >
                            <option value="use_existing">Usar existente</option>
                            <option value="create_new">Criar novo</option>
                            <option value="skip">Pular</option>
                          </Select>
                        </TD>
                        <TD className="align-top">
                          {state.action === "use_existing" && (
                            <Select
                              value={state.ingredientId}
                              onChange={(e) =>
                                updateItem(idx, {
                                  ingredientId: e.currentTarget.value,
                                })
                              }
                              className="w-72"
                            >
                              <option value="">— escolher —</option>
                              {ingredients.map((ing) => (
                                <option key={ing.id} value={ing.id}>
                                  {ing.name} —{" "}
                                  {INGREDIENT_CATEGORY_LABEL[ing.category]} (
                                  {INGREDIENT_UNIT_LABEL[ing.unit]})
                                </option>
                              ))}
                            </Select>
                          )}
                          {state.action === "create_new" && (
                            <div className="space-y-1.5 w-72">
                              <Input
                                value={state.newName}
                                onChange={(e) =>
                                  updateItem(idx, {
                                    newName: e.currentTarget.value,
                                  })
                                }
                                placeholder="Nome do novo ingrediente"
                              />
                              <div className="flex gap-1.5">
                                <Select
                                  value={state.newCategory}
                                  onChange={(e) =>
                                    updateItem(idx, {
                                      newCategory: e.currentTarget
                                        .value as IngredientCategory,
                                    })
                                  }
                                >
                                  {CATEGORIES.map((c) => (
                                    <option key={c.value} value={c.value}>
                                      {c.label}
                                    </option>
                                  ))}
                                </Select>
                                <Select
                                  value={state.newUnit}
                                  onChange={(e) =>
                                    updateItem(idx, {
                                      newUnit: e.currentTarget
                                        .value as IngredientUnit,
                                    })
                                  }
                                >
                                  {UNITS.map((u) => (
                                    <option key={u.value} value={u.value}>
                                      {u.label}
                                    </option>
                                  ))}
                                </Select>
                              </div>
                            </div>
                          )}
                          {state.action === "skip" && (
                            <span className="text-xs text-slate-400 italic">
                              ignorado
                            </span>
                          )}

                          {state.action !== "skip" && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              <Input
                                value={state.lotNumber}
                                onChange={(e) =>
                                  updateItem(idx, {
                                    lotNumber: e.currentTarget.value,
                                  })
                                }
                                placeholder="Lote"
                                className="w-24"
                              />
                              <Input
                                type="date"
                                value={state.expiryDate}
                                onChange={(e) =>
                                  updateItem(idx, {
                                    expiryDate: e.currentTarget.value,
                                  })
                                }
                                className="w-36"
                              />
                              {state.action === "use_existing" && (
                                <label className="text-[11px] text-slate-600 inline-flex items-center gap-1">
                                  <input
                                    type="checkbox"
                                    className="h-3 w-3 rounded border-slate-300 text-roxa-700"
                                    checked={state.updateIngredientCost}
                                    onChange={(e) =>
                                      updateItem(idx, {
                                        updateIngredientCost:
                                          e.currentTarget.checked,
                                      })
                                    }
                                  />
                                  atualiza custo
                                </label>
                              )}
                            </div>
                          )}
                        </TD>
                        <TD className="align-top">
                          {state.action !== "skip" ? (
                            <Input
                              type="number"
                              step="0.0001"
                              value={state.quantity}
                              onChange={(e) =>
                                updateItem(idx, {
                                  quantity: e.currentTarget.value,
                                })
                              }
                              className="text-right w-24"
                            />
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </TD>
                        <TD className="align-top">
                          {state.action !== "skip" ? (
                            <Input
                              type="number"
                              step="0.0001"
                              value={state.unitCost}
                              onChange={(e) =>
                                updateItem(idx, {
                                  unitCost: e.currentTarget.value,
                                })
                              }
                              className="text-right w-24"
                            />
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </CardContent>
          </Card>

          {/* Step 5 — Confirmação */}
          <Card>
            <CardHeader>
              <CardTitle>5. Como salvar?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-3">
                <RadioOption
                  checked={statusOption === "RASCUNHO"}
                  onChange={() => setStatusOption("RASCUNHO")}
                  label="Salvar como rascunho (revisar antes de confirmar)"
                />
                <RadioOption
                  checked={statusOption === "CONFIRMADA"}
                  onChange={() => setStatusOption("CONFIRMADA")}
                  label="Confirmar agora (gera estoque + atualiza custos)"
                />
              </div>

              <div className="text-xs text-slate-500 flex items-start gap-1.5 pt-2 border-t border-slate-100">
                <CheckCircle2 className="h-3 w-3 mt-0.5 text-slate-400" />
                {statusOption === "CONFIRMADA"
                  ? "Ao confirmar, cada item gera StockMovement de ENTRADA e (se 'atualiza custo' estiver marcado) atualiza Ingredient.unitCost com cascata para fichas/produtos/combos."
                  : "Em rascunho, nada é alterado no estoque ou custos. Você poderá revisar e confirmar depois em /compras."}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button type="button" onClick={execute} disabled={isPending}>
              {isPending ? "Importando…" : "Importar"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function RadioOption({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 border-slate-300 text-roxa-700 focus:ring-roxa-500"
      />
      {label}
    </label>
  );
}
