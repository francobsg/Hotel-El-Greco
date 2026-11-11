"use client";
import { useRef, useState, type FormEvent } from "react";
import { Plus, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formulario_guia, etiquetas_tipo, tipos_guia, type DetalleGuia } from "@/lib/guias/tipos";
import { validar_stock_formulario } from "@/lib/guias/validacion";
import { fecha_chile } from "@/lib/stats/tipos";
import { ItemGuia, type ItemFormulario } from "./ItemGuia";
import { ReciboGuia } from "./ReciboGuia";
import Link from "next/link";
import { comprimir_factura } from "@/lib/escaner/comprimir";
export type InicialGuia = { fecha?: string; n_factura?: string; proveedor?: string; bodega_ajuste?: 1 | 2; items: ItemFormulario[] };
const campo = "mt-1 block w-full min-w-0 rounded-lg border border-verde-900/15 bg-white px-3 py-2.5 text-sm";
const item_vacio = (clave: number): ItemFormulario => ({ clave, producto_id: 0, cantidad: "", marca: "", descripcion: "" });
export function FormularioGuia({ tipo_inicial, superadmin, inicial, escaneo, al_reiniciar, al_guardada, al_enviando }: { tipo_inicial: typeof tipos_guia[number]; superadmin: boolean; inicial?: InicialGuia; escaneo?: { token: string; categorias: { id: number; nombre: string }[] }; al_reiniciar?: () => void; al_guardada?: () => void; al_enviando?: (enviando: boolean) => void }) {
  const [tipo, set_tipo] = useState(tipo_inicial);
  const [fecha, set_fecha] = useState(inicial?.fecha ?? fecha_chile());
  const [factura, set_factura] = useState(inicial?.n_factura ?? "");
  const [proveedor, set_proveedor] = useState(inicial?.proveedor ?? "");
  const [confirmado, set_confirmado] = useState(false);
  const [glosa, set_glosa] = useState("");
  const [bodega, set_bodega] = useState<1 | 2>(inicial?.bodega_ajuste ?? 1);
  const [items, set_items] = useState<ItemFormulario[]>(inicial?.items.length ? inicial.items : [item_vacio(1)]);
  const siguiente = useRef((inicial?.items.length ?? 1) + 1);
  const archivo = useRef<HTMLInputElement>(null);
  const [enviando, set_enviando] = useState(false);
  const [error, set_error] = useState("");
  const [refresco, set_refresco] = useState(0);
  const [guia, set_guia] = useState<DetalleGuia | null>(null);
  const [folio, set_folio] = useState("");
  const origen = tipo === "traspaso" ? 1 : tipo === "consumo" ? 2 : tipo === "ajuste_negativo" ? bodega : null;
  async function cargar_recibo(folio: string) {
    set_error("");
    try { const respuesta = await fetch(`/guias/nueva/api/guias/${folio}`); const datos = await respuesta.json(); if (!respuesta.ok) throw new Error(datos.error); set_guia(datos); }
    catch { set_error("La guía quedó registrada. No vuelvas a enviarla; reintenta cargar el detalle."); }
  }
  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault(); set_error("");
    if (escaneo && !confirmado) { set_error("Revisa y confirma los datos de la factura antes de guardar."); return; }
    if (items.some((item) => item.producto_id <= 0)) { set_error("Elige o crea un producto del catálogo para cada ítem."); return; }
    if (items.some((item) => item.unidad_ocr && item.producto && item.unidad_ocr !== item.producto.unidad && !item.conversion_confirmada)) { set_error("Revisa la conversión de cantidades a la unidad del catálogo."); return; }
    const resultado = formulario_guia.safeParse({ tipo, fecha, n_factura: factura, glosa: [proveedor ? `Proveedor: ${proveedor}` : "", glosa].filter(Boolean).join("\n"), bodega_ajuste: bodega, items: items.map(({ producto_id, cantidad, marca, descripcion }) => ({ producto_id, cantidad, marca, descripcion })) });
    if (!resultado.success) { set_error(resultado.error.issues[0].message); return; }
    const error_stock = validar_stock_formulario(resultado.data, items.flatMap((item) => item.producto ? [item.producto] : []));
    if (error_stock) { set_error(error_stock); return; }
    const foto = archivo.current?.files?.[0];
    if (foto && foto.size > 5 * 1024 * 1024) { set_error("La foto no puede superar 5 MB."); return; }
    const formulario = new FormData(); formulario.set("datos", JSON.stringify(resultado.data));
    if (escaneo) { formulario.set("escaneo", escaneo.token); formulario.set("confirmado", "si"); }
    set_enviando(true); al_enviando?.(true);
    try {
      if (foto) formulario.set("factura", await comprimir_factura(foto));
      const respuesta = await fetch("/guias/nueva/api/registrar", { method: "POST", body: formulario });
      const datos = await respuesta.json(); if (!respuesta.ok) throw new Error(datos.error);
      set_folio(datos.folio); al_guardada?.(); if (datos.guia) set_guia(datos.guia); else await cargar_recibo(datos.folio);
    } catch (error) { set_error(error instanceof Error ? error.message : "No se pudo registrar la guía."); }
    finally { set_enviando(false); al_enviando?.(false); }
  }
  if (folio) return <><p role="status" className="no-imprimir rounded-lg bg-normal/10 p-3 text-normal">Guía registrada: {folio}.</p>{error && <div className="no-imprimir"><p role="alert" className="text-critico">{error}</p><Button onClick={() => cargar_recibo(folio)}>Cargar detalle</Button></div>}{guia && <ReciboGuia guia={guia} />}{escaneo ? <div className="no-imprimir flex flex-wrap gap-3"><Link className="inline-flex min-h-11 items-center rounded-lg bg-verde-700 px-4 py-2 text-sm font-semibold text-white" href={`/guias/nueva?tipo=traspaso&desde=${folio}`}>Hacer traspaso a Bodega 2</Link><Button variante="secundario" onClick={al_reiniciar}>Escanear otra factura</Button></div> : <Button className="no-imprimir" variante="secundario" onClick={() => { set_folio(""); set_guia(null); set_items([item_vacio(siguiente.current++)]); set_factura(""); set_glosa(""); set_error(""); set_fecha(fecha_chile()); }}>Registrar otra guía</Button>}</>;
  return <Card><form onSubmit={guardar} className="no-imprimir space-y-6"><fieldset disabled={enviando} className="min-w-0 space-y-6">
    <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3"><label className="text-sm">Tipo de guía<select aria-label="Tipo de guía" className={campo} value={tipo} disabled={!!escaneo} onChange={(evento) => { set_tipo(evento.target.value as typeof tipo); set_error(""); }}>{tipos_guia.filter((tipo) => superadmin || !tipo.startsWith("ajuste_")).map((tipo) => <option key={tipo} value={tipo}>{etiquetas_tipo[tipo]}</option>)}</select></label><label className="text-sm">Folio automático<input readOnly className={`${campo} bg-crema`} value="Se asignará al guardar" /></label><label className="text-sm">Fecha de entrada / movimiento<input aria-label="Fecha de movimiento" className={campo} required type="date" max={fecha_chile()} value={fecha} onChange={(evento) => { set_fecha(evento.target.value); set_confirmado(false); }} /></label></div>
    {tipo === "entrada" && <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">N° factura<input aria-label="Número de factura" className={campo} required maxLength={100} value={factura} onChange={(evento) => { set_factura(evento.target.value); set_confirmado(false); }} /></label>{!escaneo && <label className="text-sm">Foto de factura (opcional)<input ref={archivo} className={campo} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" /><span className="mt-1 block text-xs text-texto-secundario">JPG, PNG o WebP · máximo 5 MB</span></label>}</div>}
    {tipo.startsWith("ajuste_") && <label className="block text-sm">Bodega del ajuste<select aria-label="Bodega del ajuste" className={campo} value={bodega} onChange={(evento) => set_bodega(Number(evento.target.value) as 1 | 2)}><option value="1">Bodega 1 (Principal)</option><option value="2">Bodega 2 (Cocina)</option></select></label>}
    <p className="rounded-lg bg-crema p-3 text-sm">{tipo === "entrada" ? "Compra con factura → Bodega 1 (Principal)." : tipo === "traspaso" ? "Bodega 1 (Principal) → Bodega 2 (Cocina)." : tipo === "consumo" ? "Consumo desde Bodega 2 (Cocina)." : `Ajuste de existencias en Bodega ${bodega}.`}</p>
    {items.map((item, indice) => <ItemGuia key={item.clave} item={item} indice={indice} origen={origen} bloqueado={enviando} refresco={refresco} escaneo={escaneo} al_cambiar={(datos) => { if (Object.keys(datos).some((clave) => clave !== "producto")) set_confirmado(false); set_items((items) => items.map((actual) => actual.clave === item.clave ? { ...actual, ...datos } : actual)); }} al_eliminar={items.length > 1 ? () => { set_confirmado(false); set_items((items) => items.filter((actual) => actual.clave !== item.clave)); } : undefined} />)}
    <div className="flex flex-wrap gap-3"><Button variante="secundario" disabled={items.length >= 200} onClick={() => { set_confirmado(false); set_items((items) => [...items, item_vacio(siguiente.current++)]); }}><Plus size={16} />Agregar ítem</Button>{origen && <Button variante="secundario" onClick={() => set_refresco(refresco + 1)}><RefreshCw size={16} />Actualizar stock disponible</Button>}</div>
    {escaneo && <label className="block text-sm">Proveedor<input aria-label="Proveedor" className={campo} maxLength={150} value={proveedor} onChange={(evento) => { set_proveedor(evento.target.value); set_confirmado(false); }} /></label>}<label className="block text-sm">Glosa / Observaciones<textarea className={campo} rows={3} maxLength={2000} value={glosa} onChange={(evento) => { set_glosa(evento.target.value); set_confirmado(false); }} /></label>
  {escaneo && <label className="flex items-start gap-3 rounded-lg border border-dorado/40 bg-dorado/5 p-4 text-sm"><input aria-label="Confirmo que revisé la factura" type="checkbox" className="mt-1 size-5 shrink-0 accent-verde-700" checked={confirmado} onChange={(evento) => set_confirmado(evento.target.checked)} /><span>Revisé el número, la fecha, el proveedor y cada producto, cantidad, unidad y marca. Confirmo la entrada a Bodega 1.</span></label>}</fieldset>{error && <p role="alert" className="text-sm text-critico">{error}</p>}<Button type="submit" disabled={enviando || (!!escaneo && !confirmado)}><Save size={17} />{enviando ? "Guardando…" : escaneo ? "Confirmar y guardar entrada" : "Guardar guía"}</Button></form></Card>;
}
