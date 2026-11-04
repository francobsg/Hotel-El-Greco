import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { respuesta_error } from "@/lib/auth/http";
import { obtener_db } from "@/lib/db";
import { crear_servicio_configuracion, recursos } from "@/lib/configuracion/servicio";
export async function GET(request: Request) {
  try {
    await requireRole("superadmin", "admin");
    const p = new URL(request.url).searchParams;
    const datos = z.object({ recurso: z.enum(recursos), pagina: z.coerce.number().int().min(1).max(100000), buscar: z.string().max(150) }).parse({ recurso: p.get("recurso"), pagina: p.get("pagina") || 1, buscar: p.get("buscar") || "" });
    return NextResponse.json(await crear_servicio_configuracion(obtener_db()).listar(datos.recurso, datos.pagina, datos.buscar), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return respuesta_error(error); }
}
