"use client";
import Link from "next/link";
import { ClipboardList, Download, Eye, History, Search, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition, type FormEvent } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { etiquetas_tipo, parametros_historial, tipos_guia, type FiltrosHistorial, type PaginaGuias } from "@/lib/guias/tipos";
import { formato_fecha } from "@/lib/stats/formatos";
const campo = "mt-2 block w-full min-w-0 rounded-lg border border-verde-900/15 bg-white px-3 py-3 text-sm";
export function HistorialGuias({ filtros, datos, aviso }: { filtros: FiltrosHistorial; datos: PaginaGuias; aviso: string | null }) {
  const router = useRouter(); const [pendiente, iniciar] = useTransition();
  const parametros = parametros_historial({ ...filtros, pagina: datos.pagina });
  function buscar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget);
    const consulta = new URLSearchParams({ pagina: "1" });
    for (const [nombre, valor] of formulario) if (valor) consulta.set(nombre, String(valor));
    if (filtros.bodega) consulta.set("bodega", String(filtros.bodega));
    iniciar(() => router.push(`/historial?${consulta}`));
  }
  function enlace(pagina: number) { const consulta = new URLSearchParams(parametros); consulta.set("pagina", String(pagina)); return `/historial?${consulta}`; }
  return <><PageHeader icono={History} titulo="Historial General de Movimientos" subtitulo="Consulta y seguimiento detallado de todos los movimientos realizados en el sistema." />
    <Card><h2 className="mb-5 flex items-center gap-2 border-b border-dorado/40 pb-4 text-base"><SlidersHorizontal size={18} />Filtros de búsqueda</h2>
      <form key={parametros.toString()} onSubmit={buscar} className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1fr_auto_auto]"><label className="text-sm font-medium">Buscar por Folio<input aria-label="Buscar por Folio" name="folio" className={campo} placeholder="N° Factura / Guía" maxLength={100} defaultValue={filtros.folio} /></label><label className="text-sm font-medium">Fecha Inicio<input aria-label="Fecha Inicio" name="inicio" type="date" className={campo} defaultValue={filtros.inicio ?? ""} /></label><label className="text-sm font-medium">Fecha Fin<input aria-label="Fecha Fin" name="fin" type="date" className={campo} defaultValue={filtros.fin ?? ""} /></label><label className="text-sm font-medium">Tipo<select aria-label="Tipo de historial" name="tipo" className={campo} defaultValue={filtros.tipo ?? ""}><option value="">Todos</option>{[...tipos_guia, "salida", "venta"].map((tipo) => <option key={tipo} value={tipo}>{etiquetas_tipo[tipo]}</option>)}</select></label><Button type="submit" disabled={pendiente}><Search size={16} />Buscar</Button><a href={`/api/historial/exportar?${parametros}`} download className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-verde-700 px-4 py-2 text-sm font-semibold text-verde-700"><Download size={16} />Exportar Lista</a></form>
      {filtros.bodega && <p className="mt-4 text-sm">Bodega {filtros.bodega} · <Link href={`/historial?${(() => { const consulta = new URLSearchParams(parametros); consulta.delete("bodega"); consulta.set("pagina", "1"); return consulta; })()}`} className="text-verde-700 underline">Ver todas las bodegas</Link></p>}
      {aviso && <p role="alert" className="mt-3 text-sm text-critico">{aviso}</p>}{pendiente && <p role="status" className="mt-3 text-sm">Buscando guías…</p>}
    </Card>
    <Card><h2 className="mb-5 flex items-center gap-2 text-base"><ClipboardList size={18} />Resultados del Historial</h2><div aria-busy={pendiente}><DataTable titulo="Historial de guías" filas={datos.filas} clave_fila={(guia) => guia.id} columnas={[{ clave: "fecha", titulo: "Fecha", contenido: (guia) => <span className="whitespace-nowrap">{formato_fecha(guia.fecha)}</span> }, { clave: "folio", titulo: "Folio", contenido: (guia) => <Link className="font-semibold text-verde-700 underline" href={`/historial/${guia.folio}`}>{guia.folio}</Link> }, { clave: "tipo", titulo: "Tipo", contenido: (guia) => <Badge estado={["consumo", "salida", "venta", "ajuste_negativo"].includes(guia.tipo) ? "critico" : "normal"}>{etiquetas_tipo[guia.tipo]}{guia.provisional ? " · Provisional" : ""}</Badge> }, { clave: "bodegas", titulo: "Origen / Destino", contenido: (guia) => <div className="min-w-40 text-xs"><p>{guia.origen ?? "Proveedor / Entrada"}</p><p className="mt-1 text-texto-secundario">→ {guia.destino ?? "Consumo / Salida"}</p></div> }, { clave: "items", titulo: "Ítems", contenido: (guia) => <div className="min-w-36"><p className="text-sm">{guia.total_items} ítem{guia.total_items === 1 ? "" : "s"}</p><p className="mt-1 line-clamp-2 text-xs text-texto-secundario" title={guia.resumen_items}>{guia.resumen_items}</p></div> }, { clave: "glosa", titulo: "Glosa / Obs.", contenido: (guia) => <p className="min-w-24 max-w-48 truncate" title={guia.glosa ?? ""}>{guia.glosa ?? "—"}</p> }, { clave: "usuario", titulo: "Usuario", contenido: (guia) => guia.usuario }, { clave: "acciones", titulo: "Acciones", contenido: (guia) => <Link aria-label={`Ver guía ${guia.folio}`} href={`/historial/${guia.folio}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-verde-700 px-3 text-verde-700"><Eye size={15} />Ver</Link> }]} mensaje_vacio={<div className="py-6"><ClipboardList className="mx-auto mb-5 rounded-full bg-crema p-4 text-verde-700" size={88} strokeWidth={1} /><p className="font-semibold text-verde-900">No se encontraron movimientos</p><p className="mt-2 text-sm text-texto-secundario">Intenta ajustar los filtros de búsqueda para obtener resultados.</p></div>} /></div>
      <nav aria-label="Paginación del historial" className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm"><span className="text-texto-secundario">{datos.total} guías · Página {datos.pagina} de {datos.paginas}</span><div className="flex gap-4">{datos.pagina > 1 && <Link className="text-verde-700" href={enlace(datos.pagina - 1)}>← Anterior</Link>}{datos.pagina < datos.paginas && <Link className="text-verde-700" href={enlace(datos.pagina + 1)}>Siguiente →</Link>}</div></nav>
    </Card>
  </>;
}
