"use client";
import { ChevronDown } from "lucide-react";
import { useId, useRef, useState } from "react";

export function MenuProducto({ nombre, al_ver, al_consultar }: { nombre: string; al_ver: () => void; al_consultar: (bodega: 1 | 2) => void }) {
  const id = useId();
  const menu = useRef<HTMLDivElement>(null);
  const [abierto, set_abierto] = useState(false);
  function ejecutar(accion: () => void) { menu.current?.hidePopover(); accion(); }
  return <><button type="button" popoverTarget={id} aria-label={`Más acciones de ${nombre}`} aria-expanded={abierto} aria-controls={id} className="flex min-h-11 min-w-10 items-center justify-center rounded-lg bg-crema" onClick={(evento) => {
    const rectangulo = evento.currentTarget.getBoundingClientRect();
    if (!menu.current) return;
    menu.current.style.left = `${Math.max(8, Math.min(rectangulo.right - 192, window.innerWidth - 200))}px`;
    menu.current.style.top = `${Math.max(8, Math.min(rectangulo.bottom + 4, window.innerHeight - 160))}px`;
  }}><ChevronDown size={16} /></button>
    <div ref={menu} id={id} popover="auto" onToggle={(evento) => set_abierto(evento.newState === "open")} aria-label={`Acciones de ${nombre}`} className="fixed right-auto bottom-auto z-50 m-0 w-48 rounded-lg border border-verde-900/10 bg-white p-1 text-texto shadow-tarjeta">
      <button className="w-full rounded p-3 text-left text-sm hover:bg-crema" onClick={() => ejecutar(al_ver)}>Ver detalle</button>
      {([1, 2] as const).map((bodega) => <button key={bodega} className="w-full rounded p-3 text-left text-sm hover:bg-crema" onClick={() => ejecutar(() => al_consultar(bodega))}>Consultar Bodega {bodega}</button>)}
    </div>
  </>;
}
