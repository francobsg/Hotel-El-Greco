"use client";

import Image from "next/image";
import { Camera, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { comprimir_factura } from "@/lib/escaner/comprimir";
import type { PlatilloMenu } from "@/lib/caja/tipos";

type Sugerencia = { descripcion: string; platillo_id: number | null; cantidad: number | null };
export function BoletaCamara({ menu, al_aplicar, bloqueado }: { menu: PlatilloMenu[]; al_aplicar: (items: { platillo_id: number; cantidad: number }[]) => void; bloqueado: boolean }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [ocupado, set_ocupado] = useState(false);
  const [abierto, set_abierto] = useState(false);
  const [foto, set_foto] = useState<string | null>(null);
  const [items, set_items] = useState<Sugerencia[]>([]);
  const [demostracion, set_demostracion] = useState(false);
  const [error, set_error] = useState("");
  useEffect(() => () => { if (foto) URL.revokeObjectURL(foto); }, [foto]);
  async function leer(archivo: File) {
    set_abierto(true); set_ocupado(true); set_error(""); set_items([]); set_foto(null);
    try {
      const comprimida = await comprimir_factura(archivo);
      set_foto(URL.createObjectURL(comprimida));
      const formulario = new FormData(); formulario.set("imagen", comprimida);
      const respuesta = await fetch("/caja/api/boleta", { method: "POST", body: formulario });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || "No se pudo leer la boleta.");
      set_items(datos.items); set_demostracion(datos.demostracion);
    } catch (error) { set_error(error instanceof Error ? error.message : "No se pudo leer la boleta."); }
    finally { set_ocupado(false); if (entrada.current) entrada.current.value = ""; }
  }
  function aplicar() {
    if (!items.length || items.some((item) => !item.platillo_id || !item.cantidad || !Number.isInteger(item.cantidad) || item.cantidad > 999)) { set_error("Selecciona un platillo y una cantidad entera entre 1 y 999 en cada fila."); return; }
    const seleccion = items.map((item) => ({ platillo_id: item.platillo_id!, cantidad: item.cantidad! }));
    const totales = new Map<number, number>();
    for (const item of seleccion) totales.set(item.platillo_id, (totales.get(item.platillo_id) ?? 0) + item.cantidad);
    if ([...totales.values()].some((cantidad) => cantidad > 999)) { set_error("El máximo por platillo es 999 porciones."); return; }
    al_aplicar([...totales].map(([platillo_id, cantidad]) => ({ platillo_id, cantidad })));
    set_abierto(false);
  }
  return <>
    <input ref={entrada} type="file" accept="image/*" capture="environment" aria-label="Foto de boleta" className="hidden" disabled={ocupado || bloqueado} onChange={(evento) => { const archivo = evento.target.files?.[0]; if (archivo) void leer(archivo); }} />
    <Button variante="secundario" disabled={ocupado || bloqueado} onClick={() => entrada.current?.click()}><Camera size={20} aria-hidden />Escanear boleta</Button>
    <Modal abierto={abierto} titulo="Revisar boleta" al_cerrar={() => set_abierto(false)} bloqueado={ocupado}>
      <p className="mb-4 text-sm text-texto-secundario">Revisa los platillos y cantidades. Aplicar reemplaza el pedido actual; después debes confirmar la venta.</p>
      {foto && <Image src={foto} alt="Vista previa de la boleta" width={400} height={240} unoptimized className="mb-4 max-h-48 w-full rounded-lg object-contain" />}
      {ocupado && <p role="status">Leyendo boleta…</p>}
      {!ocupado && demostracion && <p className="mb-4 rounded-lg bg-dorado/10 p-3 text-sm">Modo demostración: son datos de ejemplo, no una lectura de la foto.</p>}
      {error && <p role="alert" className="mb-4 text-sm text-critico">{error}</p>}
      {!ocupado && !items.length && !error && <p>No se encontraron platillos. Puedes armar el pedido desde el menú.</p>}
      <div className="space-y-4">{items.map((item, indice) => <div key={indice} className="rounded-lg border border-verde-900/10 p-3">
        <p className="mb-2 break-words text-sm text-texto-secundario">{item.descripcion}</p>
        <label className="block text-sm">Platillo {indice + 1}<select aria-label={`Platillo de boleta ${indice + 1}`} value={item.platillo_id ?? ""} className="mt-1 min-h-11 w-full rounded-lg border border-verde-900/20 bg-white px-2" onChange={(evento) => set_items(items.map((fila, i) => i === indice ? { ...fila, platillo_id: Number(evento.target.value) || null } : fila))}><option value="">Selecciona un platillo</option>{menu.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
        <div className="mt-2 flex items-end gap-2"><label className="flex-1 text-sm">Cantidad<input aria-label={`Cantidad de boleta ${indice + 1}`} type="number" inputMode="numeric" min="1" max="999" step="1" value={item.cantidad ?? ""} className="mt-1 min-h-11 w-full rounded-lg border border-verde-900/20 px-3" onChange={(evento) => set_items(items.map((fila, i) => i === indice ? { ...fila, cantidad: Number(evento.target.value) || null } : fila))} /></label><Button variante="secundario" aria-label={`Quitar sugerencia ${indice + 1}`} onClick={() => set_items(items.filter((_, i) => i !== indice))}><Trash2 size={18} /></Button></div>
      </div>)}</div>
      <Button className="mt-5 w-full" disabled={ocupado || !items.length} onClick={aplicar}>Aplicar al pedido</Button>
    </Modal>
  </>;
}
