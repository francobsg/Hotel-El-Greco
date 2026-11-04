import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import type { UsuarioSesion } from "@/lib/auth/permisos";
import { ErrorAcceso } from "@/lib/auth/servicio";
const contenido_escaner = z.object({ usuario_id: z.number().int().positive(), version_sesion: z.number().int().nonnegative(), imagen_url: z.url().max(2048), ruta: z.string().regex(/^\d+\/[a-f0-9-]{36}\.jpg$/), almacenamiento: z.enum(["local", "supabase"]) });
const clave = () => new TextEncoder().encode(z.string().min(32).parse(process.env.AUTH_SECRET));
export async function firmar_escaneo(usuario: UsuarioSesion, imagen: { imagen_url: string; ruta: string; almacenamiento: "local" | "supabase" }) {
  return new SignJWT({ usuario_id: usuario.id, version_sesion: usuario.version_sesion, imagen_url: imagen.imagen_url, ruta: imagen.ruta, almacenamiento: imagen.almacenamiento }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2h").setIssuer("hotel-el-greco").setAudience("revision-factura").sign(clave());
}
export async function validar_escaneo(token: string, usuario: UsuarioSesion) {
  try {
    const { payload } = await jwtVerify(token, clave(), { issuer: "hotel-el-greco", audience: "revision-factura", algorithms: ["HS256"] });
    const datos = contenido_escaner.parse(payload);
    if (datos.usuario_id !== usuario.id || datos.version_sesion !== usuario.version_sesion || !datos.ruta.startsWith(`${usuario.id}/`)) throw new Error("Propietario invalido");
    return datos;
  } catch { throw new ErrorAcceso(403, "La revisión venció o no pertenece a tu sesión. Escanea la factura nuevamente."); }
}
