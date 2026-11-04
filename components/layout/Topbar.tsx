"use client";

import { Bell, LogOut, Menu, UserRound } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { etiquetas_rol, type UsuarioSesion } from "@/lib/auth/permisos";

type Propiedades = {
  al_abrir_menu: () => void;
  usuario: UsuarioSesion;
};

export function Topbar({ al_abrir_menu, usuario }: Propiedades) {
  const router = useRouter();
  const [saliendo, set_saliendo] = useState(false);
  const [error, set_error] = useState("");
  async function salir() {
    set_saliendo(true); set_error("");
    try {
      const respuesta = await fetch("/api/auth/logout", { method: "POST" });
      if (!respuesta.ok) throw new Error("No se pudo cerrar sesión.");
      router.replace("/login");
      router.refresh();
    } catch { set_error("No se pudo cerrar sesión."); set_saliendo(false); }
  }
  return (
    <header className="flex min-h-20 items-center justify-between gap-3 border-b border-white/10 bg-verde-900 px-4 text-white sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <Button variante="transparente" onClick={al_abrir_menu} aria-label="Abrir menú" aria-haspopup="dialog" aria-controls="menu-movil" className="px-2 lg:hidden">
          <Menu size={24} aria-hidden="true" />
        </Button>
        <span className="text-sm font-medium text-white/80">Sistema de inventario</span>
      </div>
      <div className="flex items-center gap-3 sm:gap-5">
        {usuario.rol !== "trabajador" && <span className="relative flex size-11 items-center justify-center" role="img" aria-label="Notificaciones: sin conexión configurada">
          <Bell size={21} aria-hidden="true" />
          <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-dorado text-[10px] font-semibold text-verde-900" aria-hidden="true">0</span>
        </span>}
        <span className="h-8 w-px bg-white/15" aria-hidden="true" />
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-white/10 p-2.5"><UserRound size={19} aria-hidden="true" /></span>
          <div className="hidden sm:block">
            <p className="text-sm font-medium">{usuario.nombre}</p>
            <p className="text-xs text-white/60">{etiquetas_rol[usuario.rol]}</p>
          </div>
        </div>
        <Button variante="transparente" disabled={saliendo} className="px-2" aria-label="Cerrar sesión" onClick={salir}><LogOut size={19} aria-hidden="true" /></Button>
        {error && <p role="alert" className="text-xs text-white">{error}</p>}
      </div>
    </header>
  );
}
