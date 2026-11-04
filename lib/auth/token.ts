import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";

import { roles, type UsuarioSesion } from "@/lib/auth/permisos";

export const nombre_cookie = "greco_sesion";
export const duracion_sesion = 8 * 60 * 60;
const contenido_sesion = z.object({ usuario_id: z.number().int().positive(), rol: z.enum(roles), version_sesion: z.number().int().nonnegative(), movil: z.boolean() });

function clave_firma() {
  const secreto = z.string().min(32, "Configura AUTH_SECRET con al menos 32 caracteres.").parse(process.env.AUTH_SECRET);
  return new TextEncoder().encode(secreto);
}

export async function firmar_sesion(usuario: Pick<UsuarioSesion, "id" | "rol" | "version_sesion">, movil: boolean) {
  return new SignJWT({ usuario_id: usuario.id, rol: usuario.rol, version_sesion: usuario.version_sesion, movil })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuedAt().setExpirationTime(`${duracion_sesion}s`)
    .setIssuer("hotel-el-greco").setAudience("inventario").sign(clave_firma());
}

export async function leer_token(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, clave_firma(), { algorithms: ["HS256"], issuer: "hotel-el-greco", audience: "inventario", maxTokenAge: `${duracion_sesion}s` });
    return contenido_sesion.parse(payload);
  } catch { return null; }
}
