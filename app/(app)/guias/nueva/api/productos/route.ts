import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { respuesta_error } from "@/lib/auth/http";
import { obtener_db } from "@/lib/db";
import { crear_servicio_inventario } from "@/lib/inventario/servicio";
import { leer_filtros_inventario } from "@/lib/inventario/tipos";
import { z } from "zod";
export async function GET(request: Request) {
  try { await requireRole("superadmin", "trabajador"); const parametros = new URL(request.url).searchParams; const id = parametros.has("producto_id") ? z.coerce.number().int().positive().max(2147483647).parse(parametros.get("producto_id")) : null; const filtros = leer_filtros_inventario({ buscar: id ? "" : parametros.get("buscar") ?? "", registros: "25" }); return NextResponse.json(await crear_servicio_inventario(obtener_db()).listar(filtros, false, id), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return respuesta_error(error); }
}
