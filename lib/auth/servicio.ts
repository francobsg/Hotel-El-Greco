import { compare } from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";

import * as esquema from "@/db/schema";
import { type Rol, type UsuarioSesion, mutacion_permitida } from "@/lib/auth/permisos";
import { leer_token } from "@/lib/auth/token";

export class ErrorAcceso extends Error {
  constructor(public estado: number, mensaje: string) { super(mensaje); }
}
export const credenciales = z.object({ email: z.string().trim().toLowerCase().max(254).pipe(z.email()), password: z.string().min(1).max(72).refine((clave) => Buffer.byteLength(clave, "utf8") <= 72), movil: z.boolean().default(false) }).strict();
// Mismo costo bcrypt para emails inexistentes. No es una credencial utilizable.
const hash_inexistente = "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";

export function validar_rol(usuario: UsuarioSesion | null, permitidos: readonly Rol[], mutacion = false): asserts usuario is UsuarioSesion {
  if (!usuario) throw new ErrorAcceso(401, "Inicia sesion para continuar.");
  if ((usuario.rol !== "superadmin" && !permitidos.includes(usuario.rol)) || (mutacion && !mutacion_permitida(usuario.rol))) throw new ErrorAcceso(403, "No tienes permiso para realizar esta accion.");
}

export function crear_servicio_auth<Resultado extends PgQueryResultHKT>(db: PgDatabase<Resultado, typeof esquema>) {
  async function autenticar(input: unknown) {
    const datos = credenciales.parse(input);
    const [usuario] = await db.select().from(esquema.usuarios).where(sql`lower(${esquema.usuarios.email}) = ${datos.email}`);
    const correcta = await compare(datos.password, usuario?.password_hash ?? hash_inexistente);
    if (!usuario?.activo || !correcta) throw new ErrorAcceso(401, "Correo o contrasena incorrectos.");
    return { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol, version_sesion: usuario.version_sesion, movil: datos.movil } satisfies UsuarioSesion;
  }
  async function sesion_actual(token: string | undefined): Promise<UsuarioSesion | null> {
    const sesion = await leer_token(token);
    if (!sesion) return null;
    const [usuario] = await db.select({ id: esquema.usuarios.id, nombre: esquema.usuarios.nombre, email: esquema.usuarios.email, rol: esquema.usuarios.rol, version_sesion: esquema.usuarios.version_sesion })
      .from(esquema.usuarios).where(and(eq(esquema.usuarios.id, sesion.usuario_id), eq(esquema.usuarios.activo, true), eq(esquema.usuarios.version_sesion, sesion.version_sesion)));
    return usuario && usuario.rol === sesion.rol ? { ...usuario, movil: sesion.movil } : null;
  }
  return { autenticar, sesion_actual };
}
