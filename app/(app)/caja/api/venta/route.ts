import { NextResponse } from "next/server";
import { respuesta_error, validar_origen } from "@/lib/auth/http";
import { registrar_venta } from "@/lib/caja/servidor";
export async function POST(request: Request) {
  try {
    validar_origen(request);
    return NextResponse.json(await registrar_venta(await request.json()), { status: 201 });
  } catch (error) { return respuesta_error(error); }
}
