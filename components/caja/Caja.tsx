"use client";

import { Minus, Plus, RefreshCw, ShoppingBasket } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import type { DatosCaja } from "@/lib/caja/tipos";
import { BoletaCamara } from "./BoletaCamara";

const numero = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 });
const dinero = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const hora = (valor: string) => new Date(valor).toLocaleTimeString("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit" });
export function Caja({ inicial }: { inicial: DatosCaja }) {
  const [datos, set_datos] = useState(inicial);
  const [pedido, set_pedido] = useState<Record<number, number>>({});
  const [clave, set_clave] = useState<string | null>(null);
  const [revisando, set_revisando] = useState(false);
  const [guardando, set_guardando] = useState(false);
  const [refrescando, set_refrescando] = useState(false);
  const [error, set_error] = useState("");
  const [exito, set_exito] = useState("");
  const [buscar, set_buscar] = useState("");
  const seleccion = datos.menu.filter((p) => pedido[p.id] > 0).map((p) => ({ ...p, cantidad: pedido[p.id] }));
  const total = seleccion.reduce((n, p) => n + p.cantidad, 0);
  const total_dia = datos.resumen.platos.reduce((n, p) => n + p.cantidad, 0);
  async function refrescar() {
    set_refrescando(true);
    try {
      const respuesta = await fetch("/caja/api/datos", { cache: "no-store" });
      const nuevos = await respuesta.json();
      if (!respuesta.ok) throw new Error(nuevos.error || "No se pudo actualizar el resumen.");
      set_datos(nuevos);
    } catch (error) { set_error(error instanceof Error ? error.message : "No se pudo actualizar el resumen."); }
    finally { set_refrescando(false); }
  }
  function cambiar(id: number, delta: number) {
    set_pedido((actual) => ({ ...actual, [id]: Math.max(0, Math.min(999, (actual[id] ?? 0) + delta)) }));
    set_clave(null); set_error(""); set_exito("");
  }
  async function confirmar() {
    if (guardando || !clave) return;
    set_guardando(true); set_error(""); set_exito("");
    try {
      const respuesta = await fetch("/caja/api/venta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clave, confirmada: true, items: seleccion.map((p) => ({ platillo_id: p.id, cantidad: p.cantidad })) }) });
      const venta = await respuesta.json();
      if (!respuesta.ok) throw new Error(venta.error || "No se pudo registrar la venta.");
      set_pedido({}); set_clave(null); set_revisando(false);
      set_exito(`Venta confirmada · ${venta.folio} · Provisional. Se descontaron los ingredientes de Bodega 2.`);
      await refrescar();
    } catch (error) { set_error(error instanceof Error ? error.message : "No se pudo registrar la venta. Reintenta la misma confirmación."); }
    finally { set_guardando(false); }
  }
  return <div className={`space-y-6 ${total ? "pb-24 xl:pb-0" : ""}`}>
    <div className="flex flex-wrap gap-3"><BoletaCamara menu={datos.menu} bloqueado={guardando} al_aplicar={(items) => { set_pedido(Object.fromEntries(items.map((i) => [i.platillo_id, i.cantidad]))); set_clave(null); set_error(""); set_exito(""); }} /><Button variante="secundario" disabled={refrescando || guardando} onClick={() => { set_error(""); void refrescar(); }}><RefreshCw size={18} aria-hidden />{refrescando ? "Actualizando…" : "Actualizar stock y resumen"}</Button></div>
    {exito && <p role="status" className="rounded-lg border border-normal/20 bg-normal/10 p-4 text-sm text-verde-900">{exito}</p>}
    {error && !revisando && <p role="alert" className="rounded-lg bg-critico/10 p-4 text-sm text-critico">{error}</p>}
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section aria-label="Menú de platillos" className="min-w-0">
        <label className="mb-4 block text-sm font-medium">Buscar platillo<input type="search" value={buscar} onChange={(e) => set_buscar(e.target.value)} placeholder="Nombre del platillo" className="mt-2 min-h-11 w-full rounded-lg border border-verde-900/20 bg-white px-4" /></label>
        {!datos.menu.length && <Card><p>No hay platillos activos. Solicita la configuración del menú y sus recetas.</p></Card>}
        {datos.menu.length > 0 && !datos.menu.some((p) => p.nombre.toLocaleLowerCase("es-CL").includes(buscar.toLocaleLowerCase("es-CL"))) && <Card><p>No se encontraron platillos.</p></Card>}
        <div className="grid gap-4 sm:grid-cols-2">{datos.menu.filter((p) => p.nombre.toLocaleLowerCase("es-CL").includes(buscar.toLocaleLowerCase("es-CL"))).map((p) => <Card key={p.id} className="flex min-w-0 flex-col" >
          <h2 className="text-base">{p.nombre}</h2><p className="mt-2 text-lg font-semibold text-verde-900">{p.precio === null ? "Precio no definido" : dinero.format(Number(p.precio))}</p>
          <p className={`mt-2 flex-1 text-xs ${p.disponible === 0 ? "text-critico" : "text-texto-secundario"}`}>{p.error_receta || (p.disponible ? `Disponibles aprox.: ${p.disponible} porciones` : "Sin ingredientes suficientes en Bodega 2")}</p>
          <div className="mt-4 flex items-center justify-between gap-3"><Button variante="secundario" aria-label={`Quitar ${p.nombre}`} disabled={guardando || !pedido[p.id]} onClick={() => cambiar(p.id, -1)}><Minus size={20} /></Button><output aria-label={`Cantidad de ${p.nombre}`} className="text-xl font-semibold tabular-nums">{pedido[p.id] ?? 0}</output><Button aria-label={`Agregar ${p.nombre}`} disabled={guardando || !p.disponible || (pedido[p.id] ?? 0) >= Math.min(999, p.disponible)} onClick={() => cambiar(p.id, 1)}><Plus size={20} /></Button></div>
        </Card>)}</div>
      </section>
      <Card className="xl:sticky xl:top-24"><h2 className="flex items-center gap-2 text-lg"><ShoppingBasket size={22} aria-hidden />Pedido actual</h2>
        {!seleccion.length ? <p className="my-5 text-sm text-texto-secundario">Agrega platillos del menú o revisa una boleta.</p> : <ul className="my-4 divide-y divide-verde-900/10">{seleccion.map((p) => <li key={p.id} className="flex justify-between gap-2 py-3 text-sm"><span>{p.nombre}</span><strong>×{p.cantidad}</strong></li>)}</ul>}
        <p className="mb-2 font-semibold">{total} platos</p><p className="mb-5 text-xs text-texto-secundario">La venta será provisional y descontará ingredientes de Bodega 2 al confirmarla.</p>
        <Button className="w-full" disabled={!total || guardando} onClick={() => { set_clave((actual) => actual ?? crypto.randomUUID()); set_error(""); set_revisando(true); }}>Revisar venta</Button>
        <Button variante="secundario" className="mt-2 w-full" disabled={!total || guardando} onClick={() => { set_pedido({}); set_clave(null); }}>Vaciar pedido</Button>
      </Card>
    </div>
    <section aria-label="Resumen del día" className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-xl">Resumen del día</h2><p className="mt-1 text-sm text-texto-secundario">{datos.resumen.fecha.split("-").reverse().join("/")} · Hora de Chile · {total_dia} platos provisionales</p></div><Badge estado="bajo">Pendiente de resumen diario</Badge></div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-2"><Card className="min-w-0"><h3 className="mb-4">Totales por platillo</h3><DataTable compacta titulo="Totales por platillo" filas={datos.resumen.platos} clave_fila={(p) => p.platillo_id} mensaje_vacio="Todavía no hay ventas confirmadas hoy." columnas={[{ clave: "nombre", titulo: "Platillo", contenido: (p) => p.nombre }, { clave: "cantidad", titulo: "Cantidad", contenido: (p) => numero.format(p.cantidad) }]} /></Card>
      <Card className="min-w-0"><h3 className="mb-2">Ingredientes usados (estimado)</h3><p className="mb-4 text-xs text-texto-secundario">Según las recetas descontadas en cada venta, sin cambios por recetas posteriores.</p><DataTable compacta titulo="Ingredientes usados" filas={datos.resumen.ingredientes} clave_fila={(p) => p.producto_id} mensaje_vacio="No hay descuentos de ingredientes hoy." columnas={[{ clave: "nombre", titulo: "Ingrediente", contenido: (p) => p.nombre }, { clave: "cantidad", titulo: "Usado", contenido: (p) => `${numero.format(Number(p.cantidad))} ${p.unidad}` }]} /></Card></div>
      <Card className="min-w-0"><h3 className="mb-4">Últimos registros provisionales</h3><DataTable titulo="Ventas temporales del día" filas={datos.resumen.registros} clave_fila={(p) => p.id} mensaje_vacio="Aún no hay registros provisionales." columnas={[{ clave: "hora", titulo: "Hora", contenido: (p) => hora(p.hora) }, { clave: "nombre", titulo: "Platillo", contenido: (p) => p.nombre }, { clave: "cantidad", titulo: "Cantidad", contenido: (p) => p.cantidad }, { clave: "folio", titulo: "Guía", contenido: (p) => p.folio }, { clave: "usuario", titulo: "Usuario", contenido: (p) => p.usuario }]} /></Card>
      <Card><h3 className="mb-2">Se está acabando · Bodega 2</h3><p className="mb-4 text-xs text-texto-secundario">Stock actualizado después de cada venta y al pulsar actualizar.</p>{!datos.resumen.alertas.length ? <p className="text-sm">No hay alertas de stock.</p> : <ul className="grid max-h-80 gap-3 overflow-y-auto sm:grid-cols-2">{datos.resumen.alertas.map((p) => <li key={p.producto_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-verde-900/10 p-3 text-sm"><span>{p.nombre}<span className="block text-xs text-texto-secundario">{numero.format(Number(p.cantidad))} {p.unidad}</span></span><Badge estado={p.estado}>{p.estado === "critico" ? "Crítico" : "Bajo"}</Badge></li>)}</ul>}</Card>
    </section>
    <Modal abierto={revisando} titulo="Confirmar venta provisional" bloqueado={guardando} al_cerrar={() => set_revisando(false)}><p className="mb-4 text-sm">Revisa el pedido. Al confirmar se registrarán {total} platos y se descontarán sus ingredientes de Bodega 2.</p><ul className="divide-y divide-verde-900/10">{seleccion.map((p) => <li key={p.id} className="flex justify-between gap-3 py-3"><span>{p.nombre}</span><strong>×{p.cantidad}</strong></li>)}</ul>{seleccion.every((p) => p.precio !== null) && <p className="my-4 font-semibold">Total estimado: {dinero.format(seleccion.reduce((n, p) => n + Number(p.precio) * p.cantidad, 0))}</p>}{error && <p role="alert" className="my-4 text-sm text-critico">{error}</p>}<Button className="mt-4 w-full" disabled={guardando} onClick={() => void confirmar()}>{guardando ? "Registrando…" : "Confirmar venta"}</Button></Modal>
    {total > 0 && !revisando && <div className="fixed inset-x-4 bottom-4 z-20 rounded-lg bg-white p-3 shadow-lg xl:hidden"><Button className="w-full" disabled={guardando} onClick={() => { set_clave((actual) => actual ?? crypto.randomUUID()); set_error(""); set_revisando(true); }}>Revisar pedido de caja · {total} platos</Button></div>}
  </div>;
}
