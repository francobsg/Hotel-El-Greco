"use client";
import { ArrowRightLeft, Send } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { ProductoInventario } from "@/lib/inventario/tipos";
import { formato_cantidad } from "@/lib/stats/formatos";
import { BuscadorProductos } from "./BuscadorProductos";

const campo = "w-full min-w-0 rounded-lg border border-verde-900/15 bg-white px-3 py-2.5 text-sm";
export function TraspasoRapido() {
  const router = useRouter();
  const [buscar, set_buscar] = useState("");
  const [productos, set_productos] = useState<ProductoInventario[]>([]);
  const [producto_id, set_producto_id] = useState("");
  const [cantidad, set_cantidad] = useState("");
  const [cargando, set_cargando] = useState(true);
  const [enviando, set_enviando] = useState(false);
  const [error, set_error] = useState("");
  const [mensaje, set_mensaje] = useState("");
  useEffect(() => {
    const controlador = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const respuesta = await fetch(`/api/inventario/productos?buscar=${encodeURIComponent(buscar)}&registros=25`, { signal: controlador.signal });
        const datos = await respuesta.json();
        if (!respuesta.ok) throw new Error(datos.error);
        set_productos(datos.filas); set_cargando(false);
      } catch (error) { if (!controlador.signal.aborted) { set_error(error instanceof Error ? error.message : "No se pudieron buscar los productos."); set_cargando(false); } }
    }, 250);
    return () => { clearTimeout(timer); controlador.abort(); };
  }, [buscar]);
  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault(); set_enviando(true); set_error(""); set_mensaje("");
    try {
      const respuesta = await fetch("/api/inventario/traspasos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bodega_origen_id: 1, bodega_destino_id: 2, producto_id: Number(producto_id), cantidad }) });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error);
      set_mensaje(`Traspaso registrado: ${datos.folio}.`); set_cantidad("");
      // El selector tambien muestra el saldo actualizado de origen.
      const consulta = await fetch(`/api/inventario/productos?buscar=${encodeURIComponent(buscar)}&registros=25`);
      if (consulta.ok) set_productos((await consulta.json()).filas);
      router.refresh();
    } catch (error) { set_error(error instanceof Error ? error.message : "No se pudo registrar el traspaso."); }
    finally { set_enviando(false); }
  }
  return <Card><h2 className="mb-4 flex items-center gap-2 border-b border-verde-900/10 pb-4 text-base"><ArrowRightLeft size={18} />Traspaso Rápido entre Bodegas</h2>
    <form onSubmit={enviar} className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.5fr_0.8fr_auto]">
      <label className="text-sm font-medium">Origen<select className={campo} aria-label="Origen" disabled={enviando} defaultValue="1"><option value="1">Bodega 1 (Principal)</option></select></label>
      <label className="text-sm font-medium">Destino<select className={campo} aria-label="Destino" disabled={enviando} defaultValue="2"><option value="2">Bodega 2 (Cocina)</option></select></label>
      <BuscadorProductos buscar={buscar} productos={productos} cargando={cargando} bloqueado={enviando} al_buscar={(texto) => { set_buscar(texto); set_producto_id(""); set_cargando(true); set_error(""); }} al_seleccionar={(producto) => { set_buscar(producto.nombre); set_producto_id(String(producto.id)); }} />
      <label className="text-sm font-medium">Cantidad<input className={campo} aria-label="Cantidad del traspaso" type="number" min="0.001" max="999999999.999" step="0.001" required disabled={enviando} value={cantidad} onChange={(evento) => set_cantidad(evento.target.value)} /></label>
      <Button type="submit" disabled={enviando || !producto_id || cargando} aria-label="Enviar traspaso"><Send size={18} />{enviando ? "Enviando…" : "Enviar"}</Button>
    </form><p className="mt-3 text-xs text-texto-secundario">Traspaso de hoy: Principal → Cocina.{producto_id && productos.find((producto) => producto.id === Number(producto_id)) ? ` Disponible: ${formato_cantidad(productos.find((producto) => producto.id === Number(producto_id))!.stock_1)} ${productos.find((producto) => producto.id === Number(producto_id))!.unidad}.` : " La cantidad usa la unidad del producto."}</p>
    {error && <p role="alert" className="mt-3 text-sm text-critico">{error}</p>}{mensaje && <p role="status" className="mt-3 text-sm text-normal">{mensaje}</p>}
  </Card>;
}
