import { NextResponse } from "next/server";
import { z } from "zod";

import { ErrorAcceso } from "@/lib/auth/servicio";

export function validar_origen(request: Request) {
  const origen = request.headers.get("origin");
  const host = request.headers.get("host") ?? new URL(request.url).host;
  let mismo_host = false;
  try {
    const url_origen = new URL(origen ?? "");
    mismo_host = ["http:", "https:"].includes(url_origen.protocol) && url_origen.host === host && url_origen.origin === origen;
  } catch { /* Un Origin ausente o invalido nunca se acepta. */ }
  if (!mismo_host || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new ErrorAcceso(403, "Solicitud no permitida.");
  }
}
export function respuesta_error(error: unknown) {
  if (error instanceof ErrorAcceso) return NextResponse.json({ error: error.message }, { status: error.estado });
  if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Revisa los datos ingresados." }, { status: 400 });
  return NextResponse.json({ error: "No se pudo completar la operacion. Intentalo nuevamente." }, { status: 500 });
}
