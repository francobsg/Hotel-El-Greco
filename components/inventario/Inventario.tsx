"use client";
import Link from "next/link";
import { Download, Eye, Package, Plus, Search } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, type ColumnaTabla } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { DetalleProducto } from "./DetalleProducto";
import { NuevoProducto } from "./NuevoProducto";
import { MenuProducto } from "./MenuProducto";
import { TraspasoRapido } from "./TraspasoRapido";
import { estado_stock, parametros_inventario, type FiltrosInventario, type PaginaInventario, type ProductoInventario } from "@/lib/inventario/tipos";
import { fecha_chile } from "@/lib/stats/tipos";
import { formato_cantidad, formato_fecha } from "@/lib/stats/formatos";

export function Inventario({ filtros, datos, puede_editar, categorias }: { filtros: FiltrosInventario; datos: PaginaInventario; puede_editar: boolean; categorias: { id: number; nombre: string }[] }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [nuevo, set_nuevo] = useState(false);
  const [detalle, set_detalle] = useState<number | null>(null);
  const [mensaje, set_mensaje] = useState("");
  const parametros = parametros_inventario({ ...filtros, pagina: datos.pagina });
  function cambiar(cambios: Partial<FiltrosInventario>) { const consulta = parametros_inventario({ ...filtros, pagina: 1, ...cambios }); iniciar(() => router.push(`/inventario?${consulta}`)); }
  function buscar(evento: FormEvent<HTMLFormElement>) { evento.preventDefault(); cambiar({ buscar: String(new FormData(evento.currentTarget).get("buscar") ?? "") }); }
  function enlace_pagina(pagina: number) { const consulta = new URLSearchParams(parametros); consulta.set("pagina", String(pagina)); return `/inventario?${consulta}`; }
  const columnas: ColumnaTabla<ProductoInventario>[] = [{ clave: "producto", titulo: "Producto", contenido: (producto) => <div className="flex min-w-44 items-center gap-3"><span className="rounded-lg bg-verde-700/5 p-2 text-verde-700"><Package size={18} /></span><div><span className="block font-semibold">{producto.nombre}</span><span className="text-xs text-texto-secundario">{producto.categoria}</span></div></div> }];
  for (const bodega of filtros.bodega ? [filtros.bodega] as const : [1, 2] as const) columnas.push({ clave: `stock_${bodega}`, titulo: `Stock Bodega ${bodega}`, contenido: (producto) => <div className="min-w-28 space-y-1"><p className="whitespace-nowrap font-medium">{formato_cantidad(producto[`stock_${bodega}`])} {producto.unidad}</p><Badge estado={estado_stock(producto[`stock_${bodega}`], producto)} /></div> });
  columnas.push({ clave: "niveles", titulo: "Niveles (Crít./Mín./Máx.)", contenido: (producto) => <span className="whitespace-nowrap"><span className="text-critico">{formato_cantidad(producto.stock_critico)}</span><span className="px-2 text-texto-secundario">/</span><span className="text-bajo">{formato_cantidad(producto.stock_minimo)}</span><span className="px-2 text-texto-secundario">/</span><span className="text-verde-700">{formato_cantidad(producto.stock_maximo)}</span></span> }, { clave: "costo", titulo: "Costo", contenido: (producto) => <span className="whitespace-nowrap">{new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 2 }).format(Number(producto.costo))}</span> }, { clave: "acciones", titulo: "Acciones", contenido: (producto) => <div className="flex items-center gap-2"><Button variante="secundario" onClick={() => set_detalle(producto.id)} aria-label={`Ver ${producto.nombre}`}><Eye size={15} />Ver</Button><MenuProducto nombre={producto.nombre} al_ver={() => set_detalle(producto.id)} al_consultar={(bodega) => cambiar({ bodega, buscar: producto.nombre })} /></div> });
  return <>
    <PageHeader amplio icono={Package} titulo="Gestión de Inventario" subtitulo="Control de Existencias, Niveles y Precios." acciones={<div className="flex w-full flex-wrap items-end gap-3 sm:w-auto"><label className="min-w-52 flex-1 text-xs font-semibold uppercase">Vista actual<select aria-label="Vista actual" className="mt-1 block w-full rounded-lg border border-verde-900/15 bg-white px-3 py-3 text-sm font-normal normal-case" value={filtros.bodega ?? "todas"} disabled={pendiente} onChange={(evento) => cambiar({ bodega: evento.target.value === "todas" ? null : Number(evento.target.value) as 1 | 2 })}><option value="todas">Global (Todo el Hotel)</option><option value="1">Bodega 1 (Principal)</option><option value="2">Bodega 2 (Cocina)</option></select></label><div className="flex flex-col gap-2">{puede_editar && <Button onClick={() => set_nuevo(true)}><Plus size={17} />Nuevo Producto</Button>}<a href={`/api/inventario/exportar?${parametros}`} download className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-verde-700 px-4 py-2 text-sm font-semibold text-verde-700 hover:bg-verde-700/5"><Download size={16} />Exportar Excel</a></div></div>} />
    {!puede_editar && <p className="rounded-lg border border-dorado/20 bg-dorado/5 p-3 text-sm">Tu rol Admin permite consultar y exportar el inventario en modo de solo lectura.</p>}
    {mensaje && <p role="status" className="text-sm text-normal">{mensaje}</p>}
    {filtros.fecha !== fecha_chile() && <p className="rounded-lg bg-dorado/10 p-3 text-sm">Vista histórica al {formato_fecha(filtros.fecha)}. <Link className="font-semibold underline" href={`/inventario?${parametros_inventario({ ...filtros, fecha: fecha_chile(), pagina: 1 })}`}>Volver al inventario actual</Link></p>}
    {puede_editar && filtros.fecha === fecha_chile() && <TraspasoRapido />}
    <Card><div className="mb-5 rounded-lg border-l-4 border-dorado bg-verde-900 px-4 py-3"><h2 className="font-texto text-base font-semibold text-white">Inventario {filtros.bodega ? `Bodega ${filtros.bodega}` : "Global Maestro"}</h2></div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4"><label className="flex items-center gap-2 text-sm">Mostrar<select aria-label="Registros por página" className="rounded-lg border border-verde-900/15 bg-white px-3 py-2" value={filtros.registros} disabled={pendiente} onChange={(evento) => cambiar({ registros: Number(evento.target.value) as FiltrosInventario["registros"] })}>{[10, 25, 50, 100].map((valor) => <option key={valor} value={valor}>{valor}</option>)}</select>registros</label>
        <form onSubmit={buscar} className="flex w-full items-center gap-2 sm:w-auto"><label className="sr-only" htmlFor="buscar-inventario">Buscar inventario</label><input id="buscar-inventario" name="buscar" key={filtros.buscar} defaultValue={filtros.buscar} maxLength={150} placeholder="Buscar producto…" className="min-w-0 flex-1 rounded-lg border border-verde-900/15 px-3 py-2.5 text-sm" /><Button type="submit" variante="secundario" disabled={pendiente} aria-label="Buscar en inventario"><Search size={17} /></Button></form></div>
      {filtros.alertas && <div className="mb-4 flex items-center gap-3 text-sm"><Badge estado="bajo">Alertas Stock</Badge><button className="text-verde-700 underline" onClick={() => cambiar({ alertas: false })}>Mostrar todos los estados</button></div>}
      {pendiente && <p role="status" className="mb-3 text-sm">Cargando inventario…</p>}
      <div aria-busy={pendiente}><DataTable titulo="Inventario maestro" estilo_encabezado="claro" columnas={columnas} filas={datos.filas} clave_fila={(producto) => producto.id} mensaje_vacio={filtros.buscar || filtros.alertas ? "No hay productos que coincidan con los filtros." : "Todavía no hay productos registrados."} /></div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><p className="text-texto-secundario">{datos.total ? `Mostrando ${(datos.pagina - 1) * filtros.registros + 1}–${Math.min(datos.pagina * filtros.registros, datos.total)} de ${datos.total} productos` : "0 productos"}</p><nav aria-label="Paginación del inventario" className="flex items-center gap-3">{datos.pagina > 1 ? <Link href={enlace_pagina(datos.pagina - 1)} className="rounded-lg border border-verde-900/15 p-2 text-verde-700">← Anterior</Link> : <span className="p-2 text-texto-secundario">← Anterior</span>}<span>Página {datos.pagina} de {datos.paginas}</span>{datos.pagina < datos.paginas ? <Link href={enlace_pagina(datos.pagina + 1)} className="rounded-lg border border-verde-900/15 p-2 text-verde-700">Siguiente →</Link> : <span className="p-2 text-texto-secundario">Siguiente →</span>}</nav></div>
    </Card>
    {nuevo && <NuevoProducto categorias={categorias} al_cerrar={() => set_nuevo(false)} al_guardar={(nombre) => { set_nuevo(false); set_mensaje(`Producto creado: ${nombre}. Stock inicial: 0.`); cambiar({ buscar: nombre, alertas: false }); }} />}
    {detalle !== null && <DetalleProducto key={`${detalle}_${filtros.fecha}`} id={detalle} fecha={filtros.fecha} al_cerrar={() => set_detalle(null)} />}
  </>;
}
