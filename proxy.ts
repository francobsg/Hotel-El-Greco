import { NextResponse, type NextRequest } from "next/server";

import { mutacion_permitida, ruta_inicial, ruta_permitida } from "@/lib/auth/permisos";
import { leer_token, nombre_cookie } from "@/lib/auth/token";

export async function proxy(request: NextRequest) {
  const ruta = request.nextUrl.pathname;
  if (ruta === "/uploads" || ruta.startsWith("/uploads/")) return new NextResponse(null, { status: 404 });
  if (["/manifest.webmanifest", "/sw.js", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png"].includes(ruta)) return NextResponse.next();
  const es_login = ruta === "/login" || ruta === "/api/auth/login" || ruta === "/api/auth/logout";
  if (es_login) return NextResponse.next();
  const sesion = await leer_token(request.cookies.get(nombre_cookie)?.value);
  const es_api = ruta.startsWith("/api/") || ruta.includes("/api/");
  if (!sesion) return es_api ? NextResponse.json({ error: "Inicia sesion para continuar." }, { status: 401 }) : NextResponse.redirect(new URL("/login", request.url));
  const es_logout = ruta === "/api/auth/logout";
  const escribe = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  if (escribe && !es_logout && !mutacion_permitida(sesion.rol)) return NextResponse.json({ error: "El administrador tiene acceso de solo lectura." }, { status: 403 });
  if (!es_logout && !ruta_permitida(sesion.rol, ruta)) return es_api ? NextResponse.json({ error: "Acceso no permitido." }, { status: 403 }) : NextResponse.redirect(new URL(ruta_inicial(sesion.rol, sesion.movil), request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|img/).*)"] };
