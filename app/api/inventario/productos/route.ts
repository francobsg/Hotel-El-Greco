import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMutation } from "@/lib/auth";
import { respuesta_error, validar_origen } from "@/lib/auth/http";
import { crear_producto, obtener_inventario_maestro } from "@/lib/inventario";
import { leer_filtros_inventario } from "@/lib/inventario/tipos";

export async function GET(request: Request) {
  try { return NextResponse.json(await obtener_inventario_maestro(leer_filtros_inventario(Object.fromEntries(new URL(request.url).searchParams))), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return respuesta_error(error); }
}
export async function POST(request: Request) {
  try { validar_origen(request); await requireMutation("superadmin"); return NextResponse.json(await crear_producto(await request.json()), { status: 201 }); }
  catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Revisa los datos ingresados." }, { status: 400 });
    return respuesta_error(error);
  }
}
