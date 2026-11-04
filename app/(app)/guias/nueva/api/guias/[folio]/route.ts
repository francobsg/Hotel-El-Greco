import { NextResponse } from "next/server";
import { obtener_guia } from "@/lib/guias";
import { respuesta_error } from "@/lib/auth/http";
export async function GET(_request: Request, contexto: { params: Promise<{ folio: string }> }) {
  try { const { folio } = await contexto.params; return NextResponse.json(await obtener_guia(folio, true), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return respuesta_error(error); }
}
