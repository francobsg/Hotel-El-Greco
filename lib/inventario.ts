import "server-only";
import { requireMutation, requireRole } from "@/lib/auth";
import { obtener_db } from "@/lib/db";
import { crear_servicio_inventario } from "./inventario/servicio";
import type { FiltrosInventario } from "./inventario/tipos";

export async function obtener_inventario_maestro(filtros: FiltrosInventario, completo = false) {
  await requireRole("superadmin", "admin");
  return crear_servicio_inventario(obtener_db()).listar(filtros, completo);
}
export async function obtener_categorias() {
  await requireRole("superadmin", "admin");
  return crear_servicio_inventario(obtener_db()).categorias();
}
export async function obtener_detalle_producto(id: number, filtros: FiltrosInventario) {
  await requireRole("superadmin", "admin");
  return crear_servicio_inventario(obtener_db()).detalle(id, filtros);
}
export async function crear_producto(input: unknown) {
  const actor = await requireMutation("superadmin");
  return crear_servicio_inventario(obtener_db()).guardar(actor, input);
}
