import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMutation } from "@/lib/auth";
import { respuesta_error, validar_origen } from "@/lib/auth/http";
import { obtener_db } from "@/lib/db";
import { validar_escaneo } from "@/lib/escaner/token";
import { crear_servicio_productos_escaner } from "@/lib/escaner/productos";
export async function POST(request: Request) {
  try {
    validar_origen(request); const actor = await requireMutation("superadmin", "trabajador");
    const datos = z.object({ token: z.string().max(4096), producto: z.unknown() }).strict().parse(await request.json());
    await validar_escaneo(datos.token, actor);
    return NextResponse.json(await crear_servicio_productos_escaner(obtener_db())(actor, datos.producto), { status: 201 });
  } catch (error) { return respuesta_error(error); }
}
