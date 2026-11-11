import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { respuesta_error, validar_origen } from "@/lib/auth/http";
import { obtener_db } from "@/lib/db";
import { crear_servicio_alertas } from "@/lib/stats/alertas";

const entrada = z.object({
  producto_id: z.number().int().positive(),
  bodega_id: z.union([z.literal(1), z.literal(2)]),
  accion: z.literal("ignorar"),
}).strict();

export async function PATCH(request: Request) {
  try {
    validar_origen(request);
    const actor = await requireRole("superadmin", "admin");
    await crear_servicio_alertas(obtener_db()).actualizar(actor, entrada.parse(await request.json()));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const detalle = error instanceof Error && error.cause instanceof Error
      ? `${error.cause.name}: ${error.cause.message}`
      : error instanceof Error ? error.name : "Error desconocido";
    console.error("[api/alertas PATCH]", detalle);
    return respuesta_error(error);
  }
}
