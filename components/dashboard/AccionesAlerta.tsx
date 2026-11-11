"use client";

import { EyeOff, MoreHorizontal, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = { producto_id: number; bodega_id: number; puede_resolver: boolean };

export function AccionesAlerta({ producto_id, bodega_id, puede_resolver }: Props) {
  const router = useRouter();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function cerrar_al_hacer_clic_fuera(evento: PointerEvent) {
      if (evento.target instanceof Node && !menuRef.current?.contains(evento.target)) {
        if (menuRef.current) menuRef.current.open = false;
      }
    }
    document.addEventListener("pointerdown", cerrar_al_hacer_clic_fuera);
    return () => document.removeEventListener("pointerdown", cerrar_al_hacer_clic_fuera);
  }, []);

  async function ignorar() {
    setPendiente(true);
    setError("");
    try {
      const respuesta = await fetch("/api/alertas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ producto_id, bodega_id, accion: "ignorar" }),
      });
      if (!respuesta.ok) {
        const datos: unknown = await respuesta.json();
        const mensaje = datos && typeof datos === "object" && "error" in datos && typeof datos.error === "string"
          ? datos.error
          : "No se pudo actualizar la alerta.";
        throw new Error(mensaje);
      }
      if (menuRef.current) menuRef.current.open = false;
      router.refresh();
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo actualizar la alerta.");
    } finally {
      setPendiente(false);
    }
  }

  return <div className="relative flex items-center gap-1">
    <details ref={menuRef} className="group relative">
      <summary aria-label="Acciones de alerta" className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md text-texto-secundario hover:bg-white/70 hover:text-texto focus-visible:outline-2 focus-visible:outline-verde-700">
        <MoreHorizontal size={18} aria-hidden="true" />
      </summary>
      <div className="absolute right-0 z-20 mt-1 min-w-44 rounded-lg border border-borde bg-white p-1 shadow-lg">
        <button type="button" title="Ocultar esta alerta durante siete días" disabled={pendiente} onClick={() => void ignorar()} className="flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-xs hover:bg-fondo disabled:opacity-50">
          <EyeOff size={15} aria-hidden="true" />Ignorar
        </button>
        {puede_resolver && <Link href={`/guias/nueva?tipo=ajuste_positivo&producto_id=${producto_id}&bodega_id=${bodega_id}`} className="flex min-h-10 items-center gap-2 rounded-md px-3 text-xs hover:bg-fondo">
          <Wrench size={15} aria-hidden="true" />Resolver
        </Link>}
      </div>
    </details>
    {error && <span role="alert" className="max-w-32 text-[10px] text-critico">{error}</span>}
  </div>;
}
