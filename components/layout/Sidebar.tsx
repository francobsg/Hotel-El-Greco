"use client";

import {
  ArrowLeftRight,
  BarChart3,
  BrainCircuit,
  Building2,
  History,
  LayoutDashboard,
  Package,
  ScanLine,
  Receipt,
  Settings,
  UserRound,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { clases } from "@/lib/utils";
import { etiquetas_rol, ruta_inicial, type UsuarioSesion } from "@/lib/auth/permisos";

const elementos = [
  { titulo: "Panel de Control", icono: LayoutDashboard, ruta: "/", disponible: true },
  { titulo: "Inventario", icono: Package, ruta: "/inventario", disponible: true },
  { titulo: "Operaciones", icono: ArrowLeftRight, ruta: "/guias/nueva", disponible: true },
  { titulo: "Historial", icono: History, ruta: "/historial", disponible: true },
  { titulo: "Modo caja", icono: Receipt, ruta: "/caja", disponible: true },
  { titulo: "Ventas diarias", icono: Receipt, ruta: "/ventas-diarias", disponible: true },
  { titulo: "Reportes mensuales", icono: Receipt, ruta: "/reportes", disponible: true },
  { titulo: "Estadísticas", icono: BarChart3, ruta: "/estadisticas", disponible: true },
  { titulo: "Predicción (estimación)", icono: BrainCircuit, ruta: "/prediccion", disponible: true },
  { titulo: "Configuración", icono: Settings, ruta: "/configuracion", disponible: true },
  { titulo: "Usuarios", icono: Users, ruta: "/usuarios", disponible: true },
];

type Propiedades = {
  al_cerrar?: () => void;
  usuario: UsuarioSesion;
};

export function Sidebar({ al_cerrar, usuario }: Propiedades) {
  const ruta_actual = usePathname();
  const menu = usuario.rol === "trabajador" ? [
    { titulo: "Escanear factura", icono: ScanLine, ruta: "/escaner", disponible: true },
    { titulo: "Nueva guía", icono: ArrowLeftRight, ruta: "/guias/nueva", disponible: true },
    { titulo: "Modo caja", icono: Receipt, ruta: "/caja", disponible: true },
  ] : elementos.filter((elemento) => usuario.rol !== "admin" || !["/guias/nueva", "/caja"].includes(elemento.ruta));
  return (
    <div className="flex h-full flex-col bg-verde-900 text-white">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-5 py-7">
        <Link href={ruta_inicial(usuario.rol, usuario.movil)} onClick={al_cerrar} aria-label="Hotel Museo El Greco, inicio" className="flex items-center gap-3">
          <Building2 className="shrink-0 text-dorado" size={32} aria-hidden="true" />
          <span>
            <span className="block text-[10px] font-medium tracking-[0.2em] text-white/70">HOTEL MUSEO</span>
            <span className="block font-titulo text-xl font-semibold">El Greco</span>
          </span>
        </Link>
        {al_cerrar && (
          <Button variante="transparente" className="px-2" onClick={al_cerrar} aria-label="Cerrar menú">
            <X size={22} aria-hidden="true" />
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-6">
        <p className="mb-3 px-4 text-[10px] font-semibold tracking-[0.16em] text-white/50">GESTIÓN DEL HOTEL</p>
        <nav aria-label="Menú principal" className="space-y-1">
          {menu.map(({ titulo, icono: Icono, disponible, ruta }) => {
            const activo = ruta === ruta_actual;
            const estilo = clases(
              "flex min-h-11 w-full items-center gap-3 rounded-r-lg border-l-[3px] px-4 py-3 text-left text-sm",
              activo ? "border-dorado bg-verde-700 font-semibold text-white" : disponible ? "border-transparent text-white/85 hover:bg-white/5" : "cursor-not-allowed border-transparent text-white/60",
              usuario.rol === "trabajador" && ruta !== "/escaner" && "hidden md:flex",
            );
            return disponible ? (
              <Link key={titulo} href={ruta} aria-current={activo ? "page" : undefined} className={estilo} onClick={al_cerrar}>
                <Icono size={19} className={clases("shrink-0", activo && "text-dorado")} aria-hidden="true" />
                {titulo}
                {ruta === "/ventas-diarias" && <span className="ml-auto rounded bg-dorado/20 px-1.5 py-1 text-[9px] text-white">En desarrollo</span>}
              </Link>
            ) : (
              <button key={titulo} type="button" disabled className={estilo} title="Próximamente">
                <Icono size={19} className="shrink-0" aria-hidden="true" />
                {titulo}
                <span className="sr-only">: próximamente</span>
              </button>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-3 border-t border-white/10 p-5">
        <span className="rounded-full bg-white/10 p-2.5 text-dorado"><UserRound size={20} aria-hidden="true" /></span>
        <div>
          <p className="text-sm font-medium">{usuario.nombre}</p>
          <p className="mt-0.5 text-xs text-white/60">{etiquetas_rol[usuario.rol]}</p>
        </div>
      </div>
    </div>
  );
}
