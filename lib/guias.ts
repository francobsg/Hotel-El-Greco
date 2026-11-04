import "server-only";
import { requireRole } from "@/lib/auth";
import { obtener_db } from "@/lib/db";
import { crear_servicio_guias } from "./guias/servicio";
import type { FiltrosHistorial } from "./guias/tipos";
export async function obtener_historial_guias(filtros: FiltrosHistorial, completo = false) {
  await requireRole("superadmin", "admin");
  return crear_servicio_guias(obtener_db()).listar(filtros, completo);
}
export async function obtener_guia(folio: string, utilidad = false) {
  const usuario = await requireRole(...(utilidad ? ["superadmin", "admin", "trabajador"] as const : ["superadmin", "admin"] as const));
  return crear_servicio_guias(obtener_db()).detalle(folio, usuario.rol === "trabajador" ? usuario.id : undefined);
}
