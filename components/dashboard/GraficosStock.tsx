"use client";

import dynamic from "next/dynamic";
import { Card } from "@/components/ui/Card";
import type { GraficoStock as DatosGrafico } from "@/lib/stats/tipos";

const Grafico = dynamic(() => import("@/components/dashboard/GraficoStock").then((modulo) => modulo.GraficoStock), {
  ssr: false,
  loading: () => <div role="status" className="flex h-72 items-center justify-center rounded-lg bg-crema/50 text-sm text-texto-secundario">Cargando gráfico…</div>,
});
export function GraficosStock({ graficos }: { graficos: DatosGrafico[] }) {
  return <div className="grid min-w-0 gap-5 xl:grid-cols-2">{graficos.map((grafico) => <Card key={grafico.grupo} className="min-w-0"><h3 className="mb-1 text-base">{grafico.grupo}</h3><p className="mb-5 text-xs text-texto-secundario">Stock al cierre · Una línea por categoría y unidad</p>{grafico.series.length ? <Grafico grafico={grafico} /> : <p className="flex min-h-72 items-center justify-center text-center text-sm text-texto-secundario">No hay movimientos de Bodega 2 para este grupo hasta la fecha seleccionada.</p>}</Card>)}</div>;
}
