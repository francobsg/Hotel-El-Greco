"use client";

import { RefreshCw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { fecha_chile, type FiltrosPanel as ValoresFiltros } from "@/lib/stats/tipos";

export function FiltrosPanel({ filtros, periodo = false }: { filtros: ValoresFiltros; periodo?: boolean }) {
  const router = useRouter();
  const parametros = useSearchParams();
  const [pendiente, iniciar_transicion] = useTransition();
  function cambiar(clave: string, valor: string) {
    const nuevos = new URLSearchParams(parametros.toString());
    nuevos.set(clave, valor);
    iniciar_transicion(() => router.replace(`/?${nuevos.toString()}`, { scroll: false }));
  }
  const estilo = "min-h-11 rounded-lg border border-verde-900/10 bg-white px-3 py-2 text-sm text-verde-900 disabled:opacity-60";
  return <div className="flex flex-wrap items-center gap-2" aria-busy={pendiente}>
    {periodo ? <label className="flex items-center gap-2 text-sm text-texto-secundario">Período<select aria-label="Período de los gráficos" value={filtros.dias} disabled={pendiente} onChange={(evento) => cambiar("dias", evento.target.value)} className={estilo}><option value="7">7 días</option><option value="30">30 días</option><option value="90">90 días</option></select></label> : <>
      <input key={filtros.fecha} type="date" aria-label="Fecha de corte" max={fecha_chile()} defaultValue={filtros.fecha} disabled={pendiente} onChange={(evento) => { if (evento.target.value) cambiar("fecha", evento.target.value); }} className={estilo} />
      <select aria-label="Bodega" value={filtros.bodega ?? "todas"} disabled={pendiente} onChange={(evento) => cambiar("bodega", evento.target.value)} className={estilo}><option value="todas">Todas las bodegas</option><option value="1">Bodega 1</option><option value="2">Bodega 2</option></select>
      <Button aria-label="Refrescar panel" disabled={pendiente} onClick={() => iniciar_transicion(() => router.refresh())} className="px-3"><RefreshCw size={18} aria-hidden="true" className={pendiente ? "animate-spin" : ""} /></Button>
    </>}
    <span role="status" className="text-xs text-texto-secundario">{pendiente ? "Actualizando…" : ""}</span>
  </div>;
}
