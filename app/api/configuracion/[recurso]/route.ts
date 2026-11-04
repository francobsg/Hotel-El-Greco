import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMutation } from "@/lib/auth";
import { respuesta_error, validar_origen } from "@/lib/auth/http";
import { obtener_db } from "@/lib/db";
import { crear_servicio_configuracion, recursos } from "@/lib/configuracion/servicio";
export async function POST(request: Request, { params }: { params: Promise<{ recurso: string }> }) {
  try { validar_origen(request); const actor = await requireMutation("superadmin"); const recurso = z.enum(recursos).parse((await params).recurso);
    return NextResponse.json(await crear_servicio_configuracion(obtener_db()).modificar(actor, recurso, await request.json()), { status: 201 });
  } catch (error) { return respuesta_error(error); }
}
