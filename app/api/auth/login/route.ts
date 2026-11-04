import { NextResponse } from "next/server";

import { obtener_db } from "@/lib/db";
import { respuesta_error, validar_origen } from "@/lib/auth/http";
import { ruta_inicial } from "@/lib/auth/permisos";
import { crear_servicio_auth, credenciales, ErrorAcceso } from "@/lib/auth/servicio";
import { duracion_sesion, firmar_sesion, nombre_cookie } from "@/lib/auth/token";

const intentos = new Map<string, { cantidad: number; vence: number }>();
export async function POST(request: Request) {
  try {
    validar_origen(request);
    const datos = credenciales.parse(await request.json());
    const ahora = Date.now();
    // Limite por cuenta: independiente de cabeceras de IP controladas por el cliente.
    const intento = intentos.get(datos.email);
    if (intento && intento.vence > ahora && intento.cantidad >= 8) throw new ErrorAcceso(429, "Demasiados intentos. Espera 15 minutos.");
    if (intentos.size >= 10000) {
      for (const [email, intento] of intentos) if (intento.vence <= ahora) intentos.delete(email);
      if (intentos.size >= 10000 && !intentos.has(datos.email)) throw new ErrorAcceso(429, "Intenta nuevamente mas tarde.");
    }
    intentos.set(datos.email, { cantidad: intento && intento.vence > ahora ? intento.cantidad + 1 : 1, vence: intento && intento.vence > ahora ? intento.vence : ahora + 15 * 60 * 1000 });
    const usuario = await crear_servicio_auth(obtener_db()).autenticar(datos);
    intentos.delete(datos.email);
    const token = await firmar_sesion(usuario, datos.movil);
    const respuesta = NextResponse.json({ destino: ruta_inicial(usuario.rol, datos.movil) });
    respuesta.cookies.set(nombre_cookie, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: duracion_sesion });
    return respuesta;
  } catch (error) { return respuesta_error(error); }
}
