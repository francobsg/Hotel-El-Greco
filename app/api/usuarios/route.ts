import { NextResponse } from "next/server";

import { requireMutation, requireRole } from "@/lib/auth";
import { respuesta_error, validar_origen } from "@/lib/auth/http";
import { obtener_db } from "@/lib/db";
import { crear_servicio_usuarios } from "@/lib/usuarios/servicio";

export async function GET() {
  try { return NextResponse.json(await crear_servicio_usuarios(obtener_db()).listar(await requireRole("superadmin", "admin"))); }
  catch (error) { return respuesta_error(error); }
}
export async function POST(request: Request) {
  try {
    validar_origen(request);
    const actor = await requireMutation("superadmin");
    const usuario = await crear_servicio_usuarios(obtener_db()).guardar(actor, await request.json());
    return NextResponse.json({ usuario }, { status: 201 });
  } catch (error) { return respuesta_error(error); }
}
