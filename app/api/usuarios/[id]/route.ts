import { NextResponse } from "next/server";
import { z } from "zod";

import { requireMutation } from "@/lib/auth";
import { respuesta_error, validar_origen } from "@/lib/auth/http";
import { obtener_db } from "@/lib/db";
import { crear_servicio_usuarios } from "@/lib/usuarios/servicio";

type Contexto = { params: Promise<{ id: string }> };
async function id_usuario(contexto: Contexto) {
  return z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().max(2147483647)).parse((await contexto.params).id);
}
export async function PATCH(request: Request, contexto: Contexto) {
  try {
    validar_origen(request);
    const actor = await requireMutation("superadmin");
    const id = await id_usuario(contexto);
    const usuario = await crear_servicio_usuarios(obtener_db()).guardar(actor, await request.json(), id);
    return NextResponse.json({ usuario, requiere_reingreso: id === actor.id });
  } catch (error) { return respuesta_error(error); }
}
export async function DELETE(request: Request, contexto: Contexto) {
  try {
    validar_origen(request);
    const actor = await requireMutation("superadmin");
    await crear_servicio_usuarios(obtener_db()).eliminar(actor, await id_usuario(contexto));
    return NextResponse.json({ eliminado: true });
  } catch (error) { return respuesta_error(error); }
}
