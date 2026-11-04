"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { nuevo_producto } from "@/lib/inventario/tipos";

const campo = "mt-1 w-full rounded-lg border border-verde-900/15 px-3 py-2.5";
export function NuevoProducto({ categorias, al_cerrar, al_guardar, token_escaner, inicial }: { categorias: { id: number; nombre: string }[]; al_cerrar: () => void; al_guardar: (nombre: string, id?: number) => void; token_escaner?: string; inicial?: { nombre: string; marca: string; unidad: string } }) {
  const router = useRouter();
  const [enviando, set_enviando] = useState(false);
  const [error, set_error] = useState("");
  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault(); evento.stopPropagation(); set_error("");
    const formulario = new FormData(evento.currentTarget);
    const datos = nuevo_producto.safeParse({ ...Object.fromEntries(formulario), categoria_id: Number(formulario.get("categoria_id")) });
    if (!datos.success) { set_error(datos.error.issues[0].message); return; }
    // Enviar marca como string: la normalizacion a null ocurre en el servidor.
    set_enviando(true);
    try {
      const producto = { ...datos.data, marca: datos.data.marca ?? "" };
      const respuesta = await fetch(token_escaner ? "/escaner/api/productos" : "/api/inventario/productos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(token_escaner ? { token: token_escaner, producto } : producto) });
      const resultado = await respuesta.json();
      if (!respuesta.ok) throw new Error(resultado.error);
      al_guardar(resultado.nombre, resultado.id); if (!token_escaner) router.refresh();
    } catch (error) { set_error(error instanceof Error ? error.message : "No se pudo crear el producto."); }
    finally { set_enviando(false); }
  }
  return <Modal abierto titulo="Nuevo Producto" al_cerrar={al_cerrar} bloqueado={enviando}><form onSubmit={guardar} className="space-y-4 text-sm"><fieldset disabled={enviando} className="space-y-4">
    <label className="block">Nombre<input autoFocus name="nombre" className={campo} required minLength={2} maxLength={150} defaultValue={inicial?.nombre} /></label>
    <div className="grid gap-4 sm:grid-cols-2"><label>Categoría<select aria-label="Categoría" name="categoria_id" className={campo} required defaultValue=""><option value="" disabled>Seleccione…</option>{categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>)}</select></label>
      <label>Unidad<select aria-label="Unidad" name="unidad" className={campo} defaultValue={inicial?.unidad ?? "kg"}><option value="kg">Kilogramo (kg)</option><option value="lt">Litro (lt)</option><option value="un">Unidad (un)</option><option value="caja">Caja</option></select></label></div>
    <label className="block">Marca (opcional)<input name="marca" className={campo} maxLength={100} defaultValue={inicial?.marca} /></label>
    {token_escaner ? <>{["stock_critico", "stock_minimo", "stock_maximo", "costo"].map((nombre) => <input key={nombre} type="hidden" name={nombre} value="0" />)}</> : <><div className="grid grid-cols-3 gap-3">{[["stock_critico", "Crítico"], ["stock_minimo", "Mínimo"], ["stock_maximo", "Máximo"]].map(([nombre, titulo]) => <label key={nombre}>{titulo}<input name={nombre} className={campo} type="number" min="0" max="999999999.999" step="0.001" required defaultValue="0" /></label>)}</div><label className="block">Costo (CLP)<input name="costo" className={campo} type="number" min="0" max="9999999999.99" step="0.01" required defaultValue="0" /></label></>}
    <p className="rounded-lg bg-crema p-3 text-texto-secundario">El producto se crea con stock cero. Registra una guía de entrada para agregar existencias.</p>
    {!categorias.length && <p role="alert">No hay categorías disponibles. Carga las categorías antes de crear productos.</p>}
  </fieldset>{error && <p role="alert" className="text-critico">{error}</p>}<div className="flex justify-end gap-3"><Button variante="secundario" disabled={enviando} onClick={al_cerrar}>Cancelar</Button><Button type="submit" disabled={enviando || !categorias.length}>{enviando ? "Guardando…" : "Guardar Producto"}</Button></div></form></Modal>;
}
