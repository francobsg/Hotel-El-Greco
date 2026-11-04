"use client";

import { useRef, type ReactNode } from "react";

import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import type { UsuarioSesion } from "@/lib/auth/permisos";

export function AppShell({ children, usuario }: { children: ReactNode; usuario: UsuarioSesion }) {
  const menu_movil = useRef<HTMLDialogElement>(null);

  function cerrar_menu() {
    menu_movil.current?.close();
  }

  return (
    <div className="min-h-dvh bg-crema">
      <a href="#contenido-principal" className="fixed top-3 left-3 z-50 -translate-y-24 rounded-lg bg-tarjeta px-4 py-3 text-verde-900 focus:translate-y-0">Saltar al contenido</a>
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block" aria-label="Navegación lateral">
        <Sidebar usuario={usuario} />
      </aside>
      <dialog
        ref={menu_movil}
        id="menu-movil"
        aria-label="Menú principal"
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[90vw] border-0 bg-verde-900 p-0 backdrop:bg-black/50"
        onClick={(evento) => {
          if (evento.target === evento.currentTarget) cerrar_menu();
        }}
      >
        <div className="h-full"><Sidebar usuario={usuario} al_cerrar={cerrar_menu} /></div>
      </dialog>
      <div className="lg:pl-64">
        <Topbar usuario={usuario} al_abrir_menu={() => menu_movil.current?.showModal()} />
        <main id="contenido-principal" tabIndex={-1} className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
