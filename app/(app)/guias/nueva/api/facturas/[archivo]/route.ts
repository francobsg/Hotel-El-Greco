import { sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { ErrorAcceso } from "@/lib/auth/servicio";
import { respuesta_error } from "@/lib/auth/http";
import { obtener_db } from "@/lib/db";
import { guias } from "@/db/schema";
import { leer_factura } from "@/lib/guias/facturas";
export const runtime = "nodejs";
export async function GET(_request: Request, contexto: { params: Promise<{ archivo: string }> }) {
  try {
    const usuario = await requireRole("superadmin", "admin", "trabajador");
    const { archivo } = await contexto.params;
    if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(archivo)) throw new ErrorAcceso(404, "Factura no encontrada.");
    const [guia] = await obtener_db().select({ usuario_id: guias.usuario_id }).from(guias).where(sql`${guias.imagen_factura_url} like ${`%/${archivo}`}`).limit(1);
    if (!guia || (usuario.rol === "trabajador" && guia.usuario_id !== usuario.id)) throw new ErrorAcceso(404, "Factura no encontrada.");
    const { contenido, tipo } = await leer_factura(archivo);
    return new Response(contenido, { headers: { "Content-Type": tipo, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return respuesta_error(error); }
}
