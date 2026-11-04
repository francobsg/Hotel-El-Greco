import "server-only";

import { obtener_db } from "@/lib/db";
import { requireMutation, requireRole } from "@/lib/auth";
import type { Rol } from "@/lib/auth/permisos";
import { crear_servicio_stock, type EntradaGuia } from "@/lib/stock/servicio";

export { convertir_receta_a_unidad, entrada_guia, type EntradaGuia } from "@/lib/stock/servicio";

export async function getStock(productoId: number, bodegaId: number) {
  await requireRole();
  return crear_servicio_stock(obtener_db()).getStock(productoId, bodegaId);
}

export async function registrarGuia(input: Omit<EntradaGuia, "usuario_id">, roles_permitidos: readonly Rol[] = ["superadmin", "trabajador"], opciones?: { factura_unica?: boolean }) {
  const usuario = await requireMutation(...roles_permitidos);
  return crear_servicio_stock(obtener_db()).registrarGuia({ ...input, usuario_id: usuario.id }, { roles: roles_permitidos, version_sesion: usuario.version_sesion, ...opciones });
}
