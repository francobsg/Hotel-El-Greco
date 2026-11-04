"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";

export function Modal({ abierto, titulo, al_cerrar, children, bloqueado = false, presentacion = "modal" }: { abierto: boolean; titulo: string; al_cerrar: () => void; children: ReactNode; bloqueado?: boolean; presentacion?: "modal" | "drawer" }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (abierto && !dialogo.current?.open) dialogo.current?.showModal();
    if (!abierto && dialogo.current?.open) dialogo.current.close();
  }, [abierto]);
  return (
    <dialog ref={dialogo} aria-label={titulo} onClose={al_cerrar} onCancel={(evento) => { if (bloqueado) evento.preventDefault(); }} className={`fixed max-w-lg overflow-y-auto border-0 bg-tarjeta p-6 shadow-tarjeta backdrop:bg-verde-900/60 ${presentacion === "drawer" ? "inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full sm:w-[32rem]" : "inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] rounded-tarjeta"}`}>
      <div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-xl">{titulo}</h2><Button variante="secundario" className="px-2" disabled={bloqueado} onClick={al_cerrar} aria-label="Cerrar ventana"><X size={20} /></Button></div>
      {children}
    </dialog>
  );
}
