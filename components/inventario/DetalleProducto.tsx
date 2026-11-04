"use client";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { estado_stock, type DetalleProducto as DatosDetalle } from "@/lib/inventario/tipos";
import { formato_cantidad, formato_fecha } from "@/lib/stats/formatos";

export function DetalleProducto({ id, fecha, al_cerrar }: { id: number; fecha: string; al_cerrar: () => void }) {
  const [datos, set_datos] = useState<DatosDetalle | null>(null);
  const [error, set_error] = useState("");
  const [intento, set_intento] = useState(0);
  useEffect(() => {
    const controlador = new AbortController();
    fetch(`/api/inventario/productos/${id}?fecha=${fecha}`, { signal: controlador.signal }).then(async (respuesta) => { const datos = await respuesta.json(); if (!respuesta.ok) throw new Error(datos.error); set_datos(datos); }).catch((error) => { if (!controlador.signal.aborted) set_error(error instanceof Error ? error.message : "No se pudo cargar el detalle."); });
    return () => controlador.abort();
  }, [id, fecha, intento]);
  const producto = datos?.producto;
  return <Modal abierto titulo="Detalle del producto" presentacion="drawer" al_cerrar={al_cerrar}>
    {error ? <div><p role="alert" className="text-critico">{error}</p><Button onClick={() => { set_error(""); set_intento(intento + 1); }}>Reintentar</Button></div> : !producto || !datos ? <p role="status">Cargando detalle…</p> : <div className="space-y-6"><div><h3 className="text-xl">{producto.nombre}</h3><p className="text-sm text-texto-secundario">{producto.categoria} · {producto.unidad} · {producto.marca ?? "Sin marca"}</p><p className="mt-2 text-sm">Existencias al {formato_fecha(fecha)}</p></div>
      <div className="grid grid-cols-2 gap-3">{([1, 2] as const).map((bodega) => <div key={bodega} className="rounded-lg bg-crema p-3"><p className="mb-2 text-sm">Bodega {bodega}</p><p className="mb-2 font-semibold">{formato_cantidad(producto[`stock_${bodega}`])} {producto.unidad}</p><Badge estado={estado_stock(producto[`stock_${bodega}`], producto)} /></div>)}</div>
      <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-texto-secundario">Niveles Crít. / Mín. / Máx.</dt><dd>{[producto.stock_critico, producto.stock_minimo, producto.stock_maximo].map(formato_cantidad).join(" / ")} {producto.unidad}</dd></div><div><dt className="text-texto-secundario">Costo</dt><dd>{new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 2 }).format(Number(producto.costo))}</dd></div></dl>
      <h3 className="text-base">Últimos movimientos</h3><DataTable compacta titulo="Últimos movimientos del producto" filas={datos.movimientos} clave_fila={(fila) => fila.id} columnas={[{ clave: "guia", titulo: "Guía / Tipo", contenido: (fila) => <><span className="block font-medium">{fila.folio}</span><span className="text-xs">{fila.tipo.replaceAll("_", " ")}</span></> }, { clave: "bodega", titulo: "Bodega", contenido: (fila) => fila.bodega }, { clave: "cantidad", titulo: "Cantidad", contenido: (fila) => `${Number(fila.cantidad) > 0 ? "+" : ""}${formato_cantidad(fila.cantidad)} ${producto.unidad}` }, { clave: "fecha", titulo: "Fecha", contenido: (fila) => formato_fecha(fila.fecha) }]} mensaje_vacio="Este producto no tiene movimientos hasta esta fecha." />
    </div>}
  </Modal>;
}
