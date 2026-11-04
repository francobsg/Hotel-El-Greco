"use client";
import { useId, useRef, useState } from "react";
import type { ProductoInventario } from "@/lib/inventario/tipos";
import { formato_cantidad } from "@/lib/stats/formatos";

export function BuscadorProductos({ buscar, productos, cargando, bloqueado, al_buscar, al_seleccionar, etiqueta = "Producto para traspaso" }: { buscar: string; productos: ProductoInventario[]; cargando: boolean; bloqueado: boolean; al_buscar: (texto: string) => void; al_seleccionar: (producto: ProductoInventario) => void; etiqueta?: string }) {
  const id = useId();
  const contenedor = useRef<HTMLDivElement>(null);
  const [abierto, set_abierto] = useState(false);
  const [indice, set_indice] = useState(0);
  function seleccionar(producto: ProductoInventario) { al_seleccionar(producto); set_abierto(false); }
  return <div ref={contenedor} className="relative min-w-0" onBlur={(evento) => { if (!contenedor.current?.contains(evento.relatedTarget)) set_abierto(false); }}>
    <label className="text-sm font-medium">Producto<input className="block w-full min-w-0 rounded-lg border border-verde-900/15 bg-white px-3 py-2.5 text-sm" aria-label={etiqueta} placeholder="Buscar producto…" value={buscar} disabled={bloqueado} role="combobox" aria-autocomplete="list" aria-expanded={abierto} aria-controls={id} aria-activedescendant={abierto && !cargando && productos[indice] ? `${id}_${indice}` : undefined} autoComplete="off"
      onFocus={() => set_abierto(true)} onChange={(evento) => { al_buscar(evento.target.value); set_indice(0); set_abierto(true); }} onKeyDown={(evento) => {
        if (evento.key === "Escape") set_abierto(false);
        if (evento.key === "ArrowDown" || evento.key === "ArrowUp") { evento.preventDefault(); set_abierto(true); set_indice(Math.max(0, Math.min(productos.length - 1, indice + (evento.key === "ArrowDown" ? 1 : -1)))); }
        if (evento.key === "Enter" && abierto) { evento.preventDefault(); if (!cargando && productos[indice]) seleccionar(productos[indice]); }
      }} /></label>
    {abierto && <div className="absolute top-full right-0 left-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-verde-900/15 bg-white p-1 shadow-tarjeta">
      {cargando ? <p role="status" className="p-3 text-sm">Buscando…</p> : !productos.length ? <p className="p-3 text-sm">Sin resultados</p> : null}
      <div role="listbox" id={id} aria-label="Resultados de productos">{!cargando && productos.map((producto, posicion) => <button type="button" role="option" aria-selected={posicion === indice} id={`${id}_${posicion}`} key={producto.id} className={`block w-full rounded p-3 text-left text-sm hover:bg-crema ${posicion === indice ? "bg-crema" : ""}`} onMouseDown={(evento) => evento.preventDefault()} onClick={() => seleccionar(producto)}><span className="block font-medium">{producto.nombre}</span><span className="text-xs text-texto-secundario">{producto.marca ? `${producto.marca} · ` : ""}B1: {formato_cantidad(producto.stock_1)} {producto.unidad}</span></button>)}</div>
    </div>}
  </div>;
}
