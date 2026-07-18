"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bus, Check, Plus, Trash2, X } from "lucide-react";
import {
  createSupplyTripAction,
  deleteSupplyTripAction,
  setSupplyTripStatusAction,
} from "@/server/actions/supply-trips";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";

type TripRow = {
  id: string;
  tripDate: string; // ISO
  cutoffAt: string; // ISO
  status: "AGENDADA" | "CONCLUIDA" | "CANCELADA";
  notes: string | null;
  orderCount: number;
};

const STATUS_LABEL: Record<TripRow["status"], string> = {
  AGENDADA: "Agendada",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

const STATUS_CLASS: Record<TripRow["status"], string> = {
  AGENDADA: "bg-green-100 text-green-800",
  CONCLUIDA: "bg-slate-100 text-slate-600",
  CANCELADA: "bg-red-100 text-red-700",
};

const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export function SupplyTripManager({ trips }: { trips: TripRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(trips.length === 0);
  const [tripDate, setTripDate] = useState("");
  const [cutoffAt, setCutoffAt] = useState("");
  const [notes, setNotes] = useState("");

  function create(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createSupplyTripAction({ tripDate, cutoffAt, notes });
      if (!res.ok) {
        window.alert(res.error);
        return;
      }
      setTripDate("");
      setCutoffAt("");
      setNotes("");
      setShowForm(false);
      router.refresh();
    });
  }

  function setStatus(id: string, status: TripRow["status"], confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    startTransition(async () => {
      const res = await setSupplyTripStatusAction(id, status);
      if (!res.ok) window.alert(res.error);
      else router.refresh();
    });
  }

  function remove(id: string) {
    if (!window.confirm("Excluir esta viagem? (Só é possível sem encomendas vinculadas.)"))
      return;
    startTransition(async () => {
      const res = await deleteSupplyTripAction(id);
      if (!res.ok) window.alert(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-md bg-roxa-700 px-4 py-2 text-sm font-semibold text-white hover:bg-roxa-800"
        >
          <Plus className="h-4 w-4" />
          Agendar viagem
        </button>
      )}

      {showForm && (
        <Card>
          <CardContent className="p-5">
            <form onSubmit={create} className="space-y-4">
              <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-roxa-900">
                <Bus className="h-4 w-4" />
                Nova viagem a Minas
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="space-y-1 text-xs font-medium text-slate-700">
                  Data da viagem *
                  <input
                    type="datetime-local"
                    required
                    value={tripDate}
                    onChange={(e) => setTripDate(e.currentTarget.value)}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
                  />
                </label>
                <label className="space-y-1 text-xs font-medium text-slate-700">
                  Pedidos até (data limite) *
                  <input
                    type="datetime-local"
                    required
                    value={cutoffAt}
                    onChange={(e) => setCutoffAt(e.currentTarget.value)}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
                  />
                </label>
              </div>
              <label className="block space-y-1 text-xs font-medium text-slate-700">
                Observações
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.currentTarget.value)}
                  placeholder="Ex.: foco em queijos e doces"
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-roxa-500 focus:outline-none focus:ring-1 focus:ring-roxa-500"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex items-center gap-2 rounded-md bg-roxa-700 px-4 py-2 text-sm font-semibold text-white hover:bg-roxa-800 disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  {pending ? "Salvando…" : "Agendar"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {trips.length === 0 ? (
            <EmptyState>
              Nenhuma viagem agendada. Agende a próxima ida a Minas pra abrir
              as encomendas do empório no site.
            </EmptyState>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Viagem</TH>
                  <TH>Pedidos até</TH>
                  <TH>Status</TH>
                  <TH>Encomendas</TH>
                  <TH className="text-right">Ações</TH>
                </TR>
              </THead>
              <TBody>
                {trips.map((t) => (
                  <TR key={t.id}>
                    <TD>
                      <div className="font-medium text-slate-900">{fmtDateTime(t.tripDate)}</div>
                      {t.notes && <div className="text-xs text-slate-500">{t.notes}</div>}
                    </TD>
                    <TD>{fmtDateTime(t.cutoffAt)}</TD>
                    <TD>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[t.status]}`}
                      >
                        {STATUS_LABEL[t.status]}
                      </span>
                    </TD>
                    <TD>{t.orderCount}</TD>
                    <TD>
                      <div className="flex items-center justify-end gap-1">
                        {t.status === "AGENDADA" && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setStatus(t.id, "CONCLUIDA", "Marcar viagem como concluída?")
                              }
                              disabled={pending}
                              className="rounded-md p-1.5 text-green-600 hover:bg-green-50 disabled:opacity-50"
                              title="Marcar como concluída"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setStatus(
                                  t.id,
                                  "CANCELADA",
                                  "Cancelar esta viagem? Ela some do site.",
                                )
                              }
                              disabled={pending}
                              className="rounded-md p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-50"
                              title="Cancelar viagem"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {t.orderCount === 0 && (
                          <button
                            type="button"
                            onClick={() => remove(t.id)}
                            disabled={pending}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
