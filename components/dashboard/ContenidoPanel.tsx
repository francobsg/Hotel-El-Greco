import { AlertTriangle, Bell, ChevronLeft, ChevronRight, History, Package, Users } from "lucide-react";
import Link from "next/link";
import { AccionesAlerta } from "@/components/dashboard/AccionesAlerta";
import { AccesosRapidos } from "@/components/dashboard/AccesosRapidos";
import { FiltrosPanel } from "@/components/dashboard/FiltrosPanel";
import { GraficosStock } from "@/components/dashboard/GraficosStock";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { KpiCard } from "@/components/ui/KpiCard";
import type { Rol } from "@/lib/auth/permisos";
import { obtener_panel } from "@/lib/stats";
import { formato_cantidad, formato_fecha } from "@/lib/stats/formatos";
import { fecha_chile, type FiltrosPanel as ValoresFiltros, type ResumenPanel } from "@/lib/stats/tipos";

const etiquetas_tipo: Record<string, string> = { entrada: "Compra", salida: "Salida", traspaso: "Traspaso", consumo: "Consumo", ajuste_positivo: "Ajuste +", ajuste_negativo: "Ajuste −", venta: "Venta" };
export async function ContenidoPanel({ filtros, rol, pagina_alertas }: { filtros: ValoresFiltros; rol: Rol; pagina_alertas: number }) {
  const { resumen, graficos } = await obtener_panel(filtros, pagina_alertas);
  const parametros = new URLSearchParams({ fecha: filtros.fecha, ...(filtros.bodega ? { bodega: String(filtros.bodega) } : {}) });
  const inventario = `/inventario?${parametros}`;
  const alertas = `${inventario}&estado=alerta`;
  const historial = `/historial?${parametros}`;
  function enlace_pagina_alertas(pagina: number) {
    const consulta = new URLSearchParams(parametros);
    consulta.set("pagina_alertas", String(pagina));
    return `/?${consulta}#alertas-stock`;
  }
  return <div className="space-y-6">
    <section aria-label="Indicadores del inventario" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard icono={Package} titulo="Total productos" valor={resumen.kpis.productos} enlace="/inventario" texto_enlace="Ver inventario completo" />
      <KpiCard icono={AlertTriangle} titulo="Alertas stock" valor={resumen.kpis.alertas} enlace={alertas} texto_enlace="Revisar alertas" tono="alerta" />
      <KpiCard icono={History} titulo={filtros.fecha === fecha_chile() ? "Movs. hoy" : "Movs. del día"} valor={resumen.kpis.movimientos} enlace={historial} texto_enlace="Ver historial" />
      <KpiCard icono={Users} titulo="Usuarios" valor={resumen.kpis.usuarios} enlace="/usuarios" texto_enlace="Gestionar usuarios" tono="dorado" />
    </section>
    <div className="grid min-w-0 gap-5 xl:grid-cols-[1.1fr_1fr]">
      <Card className="min-w-0"><div className="mb-5 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-base"><History size={20} className="text-verde-700" aria-hidden="true" />Últimos Movimientos</h2><Link href={historial} className="rounded-lg bg-verde-700 px-3 py-2 text-xs font-semibold text-white hover:bg-verde-900">Ver todos</Link></div>
        <DataTable<ResumenPanel["movimientos"][number]> titulo="Últimos cinco movimientos" compacta estilo_encabezado="claro" filas={resumen.movimientos} clave_fila={(fila) => fila.id} columnas={[
          { clave: "producto", titulo: "Producto", contenido: (fila) => <div className="min-w-28"><p className="text-xs font-medium">{fila.producto}</p><p className="mt-1 text-[10px] text-texto-secundario">{fila.bodega}</p></div> },
          { clave: "tipo", titulo: "Tipo", contenido: (fila) => <Badge estado={fila.tipo === "traspaso" ? "bajo" : Number(fila.cantidad) >= 0 ? "normal" : "critico"}>{etiquetas_tipo[fila.tipo] ?? fila.tipo}</Badge> },
          { clave: "cantidad", titulo: "Cant.", contenido: (fila) => <span className="text-xs whitespace-nowrap">{Number(fila.cantidad) > 0 ? "+" : ""}{formato_cantidad(fila.cantidad)} {fila.unidad}</span> },
          { clave: "fecha", titulo: "Fecha", contenido: (fila) => <span className="text-xs whitespace-nowrap">{formato_fecha(fila.fecha)}</span> },
        ]} mensaje_vacio="No hay movimientos hasta esta fecha para la bodega seleccionada." />
      </Card>
      <div className="min-w-0 space-y-5"><Card id="alertas-stock" className="min-w-0"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-base"><Bell size={20} className="text-critico" aria-hidden="true" />Alertas Stock</h2></div>
        {resumen.alertas.length ? <ul className="divide-y divide-critico/10 rounded-lg border-l-2 border-critico/40 bg-critico/5 px-3">{resumen.alertas.map((alerta) => <li key={`${alerta.producto_id}_${alerta.bodega_id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 text-xs"><div className="min-w-0"><p className="font-medium">{alerta.producto}</p><p className="mt-1 text-[10px] text-texto-secundario">{alerta.bodega}</p></div><div className="flex items-center justify-end gap-1"><div className="flex flex-wrap items-center justify-end gap-2"><span className="font-semibold whitespace-nowrap">{formato_cantidad(alerta.cantidad)} {alerta.unidad}</span><Badge estado={alerta.estado} /></div><AccionesAlerta producto_id={alerta.producto_id} bodega_id={alerta.bodega_id} puede_resolver={rol === "superadmin"} /></div></li>)}</ul> : <p className="rounded-lg bg-normal/5 p-5 text-sm text-texto-secundario">No hay productos bajo el stock mínimo para este filtro.</p>}
        {!!resumen.total_alertas && <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-texto-secundario"><p>Mostrando {Math.min((resumen.pagina_alertas - 1) * 5 + 1, resumen.total_alertas)}–{Math.min(resumen.pagina_alertas * 5, resumen.total_alertas)} de {resumen.total_alertas} alertas por producto y bodega.</p>{resumen.paginas_alertas > 1 && <nav aria-label="Paginación de alertas de stock" className="flex items-center gap-1"><Link aria-label="Alertas anteriores" aria-disabled={resumen.pagina_alertas === 1} tabIndex={resumen.pagina_alertas === 1 ? -1 : undefined} href={enlace_pagina_alertas(Math.max(1, resumen.pagina_alertas - 1))} className={`flex h-8 w-8 items-center justify-center rounded-md ${resumen.pagina_alertas === 1 ? "pointer-events-none opacity-40" : "hover:bg-white"}`}><ChevronLeft size={17} aria-hidden="true" /></Link><span aria-live="polite">{resumen.pagina_alertas}/{resumen.paginas_alertas}</span><Link aria-label="Más alertas" aria-disabled={resumen.pagina_alertas === resumen.paginas_alertas} tabIndex={resumen.pagina_alertas === resumen.paginas_alertas ? -1 : undefined} href={enlace_pagina_alertas(Math.min(resumen.paginas_alertas, resumen.pagina_alertas + 1))} className={`flex h-8 w-8 items-center justify-center rounded-md ${resumen.pagina_alertas === resumen.paginas_alertas ? "pointer-events-none opacity-40" : "hover:bg-white"}`}><ChevronRight size={17} aria-hidden="true" /></Link></nav>}</div>}
      </Card><AccesosRapidos rol={rol} /></div>
    </div>
    <section aria-label="Stock histórico de Bodega 2" className="min-w-0 space-y-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-xl">Evolución del stock · Bodega 2</h2><p className="mt-1 text-sm text-texto-secundario">Últimos {filtros.dias} días hasta {formato_fecha(filtros.fecha)}. Los gráficos siempre muestran cocina.</p></div><FiltrosPanel filtros={filtros} periodo /></div><GraficosStock graficos={graficos} /></section>
  </div>;
}
