import { NextResponse } from "next/server";

import { respuesta_error, validar_origen } from "@/lib/auth/http";
import { nombre_cookie } from "@/lib/auth/token";

export async function POST(request: Request) {
  try {
    validar_origen(request);
    const respuesta = NextResponse.json({ destino: "/login" });
    respuesta.cookies.set(nombre_cookie, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
    return respuesta;
  } catch (error) { return respuesta_error(error); }
}
