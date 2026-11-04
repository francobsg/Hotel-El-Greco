import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { obtener_db } from "@/lib/db";
import { type Rol, roles } from "@/lib/auth/permisos";
import { crear_servicio_auth, validar_rol } from "@/lib/auth/servicio";
import { nombre_cookie } from "@/lib/auth/token";

export const obtener_sesion = cache(async () => {
  const token = (await cookies()).get(nombre_cookie)?.value;
  if (!token) return null;
  return crear_servicio_auth(obtener_db()).sesion_actual(token);
});

export async function requireRole(...permitidos: Rol[]) {
  const usuario = await obtener_sesion();
  validar_rol(usuario, permitidos.length ? permitidos : roles);
  return usuario;
}
export async function requireMutation(...permitidos: Rol[]) {
  const usuario = await requireRole(...permitidos);
  validar_rol(usuario, permitidos.length ? permitidos : roles, true);
  return usuario;
}
export async function requirePage(...permitidos: Rol[]) {
  const usuario = await obtener_sesion();
  if (!usuario) redirect("/login");
  if (usuario.rol !== "superadmin" && permitidos.length && !permitidos.includes(usuario.rol)) redirect(usuario.rol === "trabajador" ? usuario.movil ? "/escaner" : "/guias/nueva" : "/");
  return usuario;
}
