import { NextResponse } from "next/server";
import { respuesta_error } from "@/lib/auth/http";
import { obtener_datos_caja } from "@/lib/caja/servidor";
export async function GET() {
  try { return NextResponse.json(await obtener_datos_caja(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return respuesta_error(error); }
}
