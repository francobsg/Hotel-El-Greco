import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMutation } from "@/lib/auth";
import { respuesta_error, validar_origen } from "@/lib/auth/http";
import { obtener_db } from "@/lib/db";
import { crear_servicio_configuracion, recursos } from "@/lib/configuracion/servicio";
type Contexto = { params: Promise<{ recurso: string; id: string }> };
async function ejecutar(request: Request, contexto: Contexto, eliminar: boolean) {
  try { validar_origen(request); const actor = await requireMutation("superadmin"); const p = await contexto.params;
    const recurso = z.enum(recursos).parse(p.recurso), id = z.coerce.number().int().positive().max(2147483647).parse(p.id);
    return NextResponse.json(await crear_servicio_configuracion(obtener_db()).modificar(actor, recurso, eliminar ? null : await request.json(), id, eliminar));
  } catch (error) { return respuesta_error(error); }
}
export const PATCH = (request: Request, contexto: Contexto) => ejecutar(request, contexto, false);
export const DELETE = (request: Request, contexto: Contexto) => ejecutar(request, contexto, true);
