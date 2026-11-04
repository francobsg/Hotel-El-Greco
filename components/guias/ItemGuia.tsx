"use client";
import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BuscadorProductos } from "@/components/inventario/BuscadorProductos";
import type { ProductoInventario } from "@/lib/inventario/tipos";
import type { FormularioGuia } from "@/lib/guias/tipos";
import { formato_cantidad } from "@/lib/stats/formatos";
import { NuevoProducto } from "@/components/inventario/NuevoProducto";
import { createPortal } from "react-dom";
export type ItemFormulario = FormularioGuia["items"][number] & { clave: number; producto?: ProductoInventario; unidad_ocr?: ProductoInventario["unidad"] | null; conversion_confirmada?: boolean };
const campo = "mt-1 block w-full min-w-0 rounded-lg border border-verde-900/15 bg-white px-3 py-2.5 text-sm";
export function ItemGuia({ item, indice, origen, bloqueado, refresco, al_cambiar, al_eliminar, escaneo }: { item: ItemFormulario; indice: number; origen: 1 | 2 | null; bloqueado: boolean; refresco: number; al_cambiar: (datos: Partial<ItemFormulario>) => void; al_eliminar?: () => void; escaneo?: { token: string; categorias: { id: number; nombre: string }[] } }) {
  const [buscar, set_buscar] = useState(item.producto?.nombre ?? (escaneo ? item.descripcion : ""));
  const [productos, set_productos] = useState<ProductoInventario[]>([]);
  const [cargando, set_cargando] = useState(true);
  const [error, set_error] = useState("");
  const [nuevo, set_nuevo] = useState(false);
  const actualizar = useRef(al_cambiar);
  useEffect(() => { actualizar.current = al_cambiar; }, [al_cambiar]);
  useEffect(() => {
    const controlador = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const respuesta = await fetch(item.producto_id ? `/guias/nueva/api/productos?producto_id=${item.producto_id}` : `/guias/nueva/api/productos?buscar=${encodeURIComponent(buscar)}`, { signal: controlador.signal });
        const datos = await respuesta.json(); if (!respuesta.ok) throw new Error(datos.error);
        set_productos(datos.filas); set_cargando(false);
        const seleccionado = (datos.filas as ProductoInventario[]).find((producto) => producto.id === item.producto_id);
        if (seleccionado) actualizar.current({ producto: seleccionado });
      } catch (error) { if (!controlador.signal.aborted) { set_error(error instanceof Error ? error.message : "No se pudieron consultar los productos."); set_cargando(false); } }
    }, 250);
    return () => { clearTimeout(timer); controlador.abort(); };
  }, [buscar, refresco, item.producto_id]);
  const producto = productos.find((producto) => producto.id === item.producto_id) ?? item.producto;
  return <fieldset disabled={bloqueado} className="min-w-0 space-y-4 rounded-lg border border-verde-900/10 bg-crema/30 p-4"><legend className="px-2 text-sm font-semibold">Ítem {indice + 1}</legend><div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <BuscadorProductos etiqueta={`Producto ítem ${indice + 1}`} buscar={buscar} productos={productos} cargando={cargando} bloqueado={bloqueado} al_buscar={(texto) => { set_buscar(texto); set_cargando(true); set_error(""); al_cambiar({ producto_id: 0, producto: undefined, conversion_confirmada: false }); }} al_seleccionar={(producto) => { set_buscar(producto.nombre); al_cambiar({ producto_id: producto.id, producto, marca: escaneo ? item.marca : producto.marca ?? "", conversion_confirmada: false }); }} />
    <label className="text-sm">Cantidad<input aria-label={`Cantidad ítem ${indice + 1}`} type="number" min="0.001" max="999999999.999" step="0.001" required className={campo} value={item.cantidad} onChange={(evento) => al_cambiar({ cantidad: evento.target.value, conversion_confirmada: false })} /></label>
    <label className="text-sm">Unidad<input aria-label={`Unidad ítem ${indice + 1}`} readOnly className={`${campo} bg-crema`} value={producto?.unidad ?? "Seleccione producto"} /></label>
    <label className="text-sm">Marca<input aria-label={`Marca ítem ${indice + 1}`} maxLength={100} className={campo} value={item.marca} onChange={(evento) => al_cambiar({ marca: evento.target.value })} /></label>
  </div><label className="block text-sm">Descripción (opcional)<input aria-label={`Descripción ítem ${indice + 1}`} maxLength={2000} className={campo} value={item.descripcion} onChange={(evento) => al_cambiar({ descripcion: evento.target.value })} /></label>
    {escaneo && <div className="space-y-2 text-sm">{!producto && <p className="text-bajo">Sin coincidencia segura. Elige un producto del catálogo o crea una ficha.</p>}<Button variante="secundario" onClick={() => { al_cambiar({ conversion_confirmada: false }); set_nuevo(true); }}>Crear producto ítem {indice + 1}</Button>{producto && item.unidad_ocr && item.unidad_ocr !== producto.unidad && <label className="flex items-start gap-2 rounded-lg bg-bajo/10 p-3"><input type="checkbox" className="mt-1" checked={!!item.conversion_confirmada} onChange={(evento) => al_cambiar({ conversion_confirmada: evento.target.checked })} aria-label={`Conversión revisada ítem ${indice + 1}`} /><span>La factura indica {item.unidad_ocr} y el catálogo usa {producto.unidad}. Revisé y convertí la cantidad a {producto.unidad}.</span></label>}</div>}
    <div className="flex flex-wrap items-center justify-between gap-2">{origen && producto ? <p className="text-xs text-texto-secundario">Disponible Bodega {origen}: {formato_cantidad(producto[`stock_${origen}`])} {producto.unidad}</p> : <span />}{al_eliminar && <Button variante="peligro" onClick={al_eliminar}><Trash2 size={16} />Quitar ítem {indice + 1}</Button>}</div>{error && <p role="alert" className="text-sm text-critico">{error}</p>}
    {nuevo && escaneo && createPortal(<NuevoProducto token_escaner={escaneo.token} categorias={escaneo.categorias} inicial={{ nombre: item.descripcion.slice(0, 150), marca: item.marca, unidad: item.unidad_ocr ?? "un" }} al_cerrar={() => set_nuevo(false)} al_guardar={async (nombre, id) => { set_nuevo(false); set_buscar(nombre); try { const respuesta = await fetch(`/guias/nueva/api/productos?producto_id=${id}`); const datos = await respuesta.json(); if (!respuesta.ok || !datos.filas[0]) throw new Error("Producto creado. Búscalo nuevamente para seleccionarlo."); const producto = datos.filas[0] as ProductoInventario; al_cambiar({ producto_id: producto.id, producto, conversion_confirmada: false }); } catch (error) { set_error(error instanceof Error ? error.message : "Selecciona el producto creado."); } }} />, document.body)}
  </fieldset>;
}
