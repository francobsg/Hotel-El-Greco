import { ArrowLeftRight, CircleMinus, CirclePlus, ShoppingCart, Star, Utensils } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { Rol } from "@/lib/auth/permisos";

const accesos = [
  { titulo: "Compra", tipo: "entrada", icono: ShoppingCart, detalle: "Entrada de proveedor", color: "text-verde-700" },
  { titulo: "Consumo", tipo: "consumo", icono: Utensils, detalle: "Salida interna", color: "text-critico" },
  { titulo: "Traspaso", tipo: "traspaso", icono: ArrowLeftRight, detalle: "Entre bodegas", color: "text-verde-700" },
  { titulo: "Ajuste +", tipo: "ajuste_positivo", icono: CirclePlus, detalle: "Corrección positiva", color: "text-dorado" },
  { titulo: "Ajuste −", tipo: "ajuste_negativo", icono: CircleMinus, detalle: "Corrección negativa", color: "text-dorado" },
];
export function AccesosRapidos({ rol }: { rol: Rol }) {
  return <Card><h2 className="mb-4 flex items-center gap-2 text-sm"><Star size={17} className="text-verde-700" aria-hidden="true" />Accesos Rápidos</h2>{rol === "admin" ? <p className="text-sm text-texto-secundario">Tu acceso es de solo lectura. Las operaciones están reservadas al superadmin.</p> : <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{accesos.map(({ titulo, tipo, icono: Icono, detalle, color }) => <Link key={tipo} href={`/guias/nueva?tipo=${tipo}`} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg bg-crema/60 p-2 text-center transition-colors hover:bg-verde-700/10"><Icono size={24} className={color} aria-hidden="true" /><span className="text-xs font-semibold text-verde-900">{titulo}</span><span className="text-[10px] text-texto-secundario">{detalle}</span></Link>)}</div>}</Card>;
}
