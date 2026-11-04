import { NextResponse } from "next/server";
import { z } from "zod";
import { respuesta_error } from "@/lib/auth/http";
import { obtener_detalle_producto } from "@/lib/inventario";
import { leer_filtros_inventario } from "@/lib/inventario/tipos";

export async function GET(request: Request, contexto: { params: Promise<{ id: string }> }) {
  try {
    const id = z.coerce.number().int().positive().max(2147483647).parse((await contexto.params).id);
    return NextResponse.json(await obtener_detalle_producto(id, leer_filtros_inventario(Object.fromEntries(new URL(request.url).searchParams))), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return respuesta_error(error); }
}
