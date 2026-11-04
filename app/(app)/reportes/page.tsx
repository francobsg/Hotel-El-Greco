import { FileSpreadsheet } from "lucide-react";
import { requirePage } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { fecha_chile } from "@/lib/stats/tipos";
import { periodo_reporte } from "@/lib/analisis/tipos";
export default async function Reportes({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePage("superadmin", "admin"); const p = await searchParams;
  const hoy = fecha_chile(); const leido = periodo_reporte.safeParse({ mes: p.mes || Number(hoy.slice(5, 7)), ano: p.ano || Number(hoy.slice(0, 4)), bodega: 1 });
  const periodo = leido.success ? leido.data : { mes: Number(hoy.slice(5, 7)), ano: Number(hoy.slice(0, 4)) };
  return <><PageHeader icono={FileSpreadsheet} titulo="Reportes mensuales" subtitulo="Movimientos y resumen de existencias por bodega." /><Card><form className="mb-6 flex flex-wrap items-end gap-4"><label className="text-sm">Mes<select name="mes" defaultValue={periodo.mes} className="mt-2 block min-h-11 rounded-lg border border-verde-900/20 px-4">{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{new Date(2026, i, 1).toLocaleString("es-CL", { month: "long" })}</option>)}</select></label><label className="text-sm">Año<input type="number" name="ano" min="2000" max="2100" defaultValue={periodo.ano} className="mt-2 block min-h-11 w-28 rounded-lg border border-verde-900/20 px-4" /></label><button className="min-h-11 rounded-lg bg-verde-700 px-4 text-white">Elegir período</button></form>{!leido.success && <p role="alert" className="mb-4 text-critico">Período inválido. Se muestra el mes actual.</p>}<div className="grid gap-4 sm:grid-cols-2">{[1, 2].map((bodega) => <a key={bodega} download href={`/api/reportes?mes=${periodo.mes}&ano=${periodo.ano}&bodega=${bodega}`} className="flex min-h-20 items-center gap-3 rounded-lg border border-verde-700 p-4 font-semibold text-verde-700"><FileSpreadsheet aria-hidden />Descargar Movimientos Bodega {bodega}</a>)}</div><p className="mt-5 text-sm text-texto-secundario">Incluye hojas Movimientos y Resumen. Stock inicial + entradas − salidas = stock final. Cantidades conservadas en la unidad de cada producto.</p></Card></>;
}
