import "server-only";
import { requireMutation, requireRole } from "@/lib/auth";
import { obtener_db } from "@/lib/db";
import { crear_servicio_caja } from "./servicio";
import type { EntradaVenta } from "./tipos";

export async function obtener_datos_caja() {
  await requireRole("superadmin", "trabajador");
  return crear_servicio_caja(obtener_db()).datos();
}
export async function registrar_venta(input: EntradaVenta) {
  const actor = await requireMutation("superadmin", "trabajador");
  return crear_servicio_caja(obtener_db()).registrar_venta(actor, input);
}
export async function obtener_dias_provisionales() {
  await requireRole("superadmin", "admin");
  return crear_servicio_caja(obtener_db()).dias();
}
