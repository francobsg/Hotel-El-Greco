import { z } from "zod";
import { sql } from "drizzle-orm";
import { guias } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { respuesta_error } from "@/lib/auth/http";
import { ErrorAcceso } from "@/lib/auth/servicio";
import { obtener_db } from "@/lib/db";
import { leer_imagen_escaner, ruta_imagen } from "@/lib/escaner/almacenamiento";
export const runtime = "nodejs";
export async function GET(_request: Request, contexto: { params: Promise<{ almacenamiento: string; usuario: string; archivo: string }> }) {
  try {
    const actor = await requireRole("superadmin", "admin", "trabajador");
    const { almacenamiento, usuario, archivo } = await contexto.params;
    const tipo = z.enum(["local", "supabase"]).parse(almacenamiento);
    const ruta = ruta_imagen.parse(`${usuario}/${archivo}`);
    if (actor.id !== Number(usuario)) {
      if (actor.rol === "trabajador") throw new ErrorAcceso(404, "Imagen no encontrada.");
      const [guia] = await obtener_db().select({ id: guias.id }).from(guias).where(sql`${guias.imagen_factura_url} like ${`%/escaner/imagen/${tipo}/${ruta}`}`).limit(1);
      if (!guia) throw new ErrorAcceso(404, "Imagen no encontrada.");
    }
    return new Response(await leer_imagen_escaner(tipo, ruta), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return respuesta_error(error); }
}
