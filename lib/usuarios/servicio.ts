import { hash } from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";

import * as esquema from "@/db/schema";
import { roles, type UsuarioSesion } from "@/lib/auth/permisos";
import { ErrorAcceso, validar_rol } from "@/lib/auth/servicio";

const clave_usuario = z.string().min(12, "La contrasena debe tener al menos 12 caracteres.").max(72).refine((clave) => Buffer.byteLength(clave, "utf8") <= 72, "La contrasena no debe superar 72 bytes.");
const campos_usuario = z.object({ nombre: z.string().trim().min(2).max(150), email: z.string().trim().toLowerCase().max(254).pipe(z.email()), rol: z.enum(roles), activo: z.boolean() });
export const nuevo_usuario = campos_usuario.extend({ password: clave_usuario }).strict();
export const editar_usuario = campos_usuario.extend({ password: clave_usuario.optional() }).strict();
export type UsuarioListado = Pick<typeof esquema.usuarios.$inferSelect, "id" | "nombre" | "email" | "rol" | "activo">;
const columnas_publicas = { id: esquema.usuarios.id, nombre: esquema.usuarios.nombre, email: esquema.usuarios.email, rol: esquema.usuarios.rol, activo: esquema.usuarios.activo };

export function crear_servicio_usuarios<Resultado extends PgQueryResultHKT>(db: PgDatabase<Resultado, typeof esquema>) {
  async function listar(actor: UsuarioSesion) {
    validar_rol(actor, ["superadmin", "admin"]);
    return db.select(columnas_publicas).from(esquema.usuarios).orderBy(esquema.usuarios.nombre, esquema.usuarios.id);
  }
  async function guardar(actor: UsuarioSesion, input: unknown, usuario_id?: number) {
    validar_rol(actor, ["superadmin"], true);
    const datos = usuario_id ? editar_usuario.parse(input) : nuevo_usuario.parse(input);
    const password_hash = datos.password ? await hash(datos.password, 12) : undefined;
    return db.transaction(async (tx) => {
      // Todas las altas/bajas/cambios de rol comparten este bloqueo.
      await tx.execute(sql`lock table usuarios in share row exclusive mode`);
      await comprobar_actor(tx, actor);
      const [repetido] = await tx.select({ id: esquema.usuarios.id }).from(esquema.usuarios).where(sql`lower(${esquema.usuarios.email}) = ${datos.email}`);
      if (repetido && repetido.id !== usuario_id) throw new ErrorAcceso(409, "Ya existe un usuario con ese correo.");
      const { password: _password, ...campos } = datos;
      void _password;
      if (!usuario_id) {
        if (!password_hash) throw new ErrorAcceso(400, "Ingresa una contrasena.");
        const [creado] = await tx.insert(esquema.usuarios).values({ ...campos, password_hash }).returning(columnas_publicas);
        return creado;
      }
      const [actual] = await tx.select().from(esquema.usuarios).where(eq(esquema.usuarios.id, usuario_id));
      if (!actual) throw new ErrorAcceso(404, "Usuario no encontrado.");
      if (actual.rol === "superadmin" && actual.activo && (datos.rol !== "superadmin" || !datos.activo)) await proteger_ultimo(tx);
      const [actualizado] = await tx.update(esquema.usuarios).set({ ...campos, ...(password_hash ? { password_hash } : {}), version_sesion: sql`${esquema.usuarios.version_sesion} + 1` }).where(eq(esquema.usuarios.id, usuario_id)).returning(columnas_publicas);
      return actualizado;
    });
  }
  async function eliminar(actor: UsuarioSesion, usuario_id: number) {
    validar_rol(actor, ["superadmin"], true);
    if (actor.id === usuario_id) throw new ErrorAcceso(409, "No puedes eliminar tu propia cuenta.");
    return db.transaction(async (tx) => {
      await tx.execute(sql`lock table usuarios in share row exclusive mode`);
      await comprobar_actor(tx, actor);
      const [actual] = await tx.select().from(esquema.usuarios).where(eq(esquema.usuarios.id, usuario_id));
      if (!actual) throw new ErrorAcceso(404, "Usuario no encontrado.");
      if (actual.rol === "superadmin" && actual.activo) await proteger_ultimo(tx);
      const guias = await tx.select({ id: esquema.guias.id }).from(esquema.guias).where(eq(esquema.guias.usuario_id, usuario_id)).limit(1);
      const ventas = await tx.select({ id: esquema.ventas_diarias.id }).from(esquema.ventas_diarias).where(eq(esquema.ventas_diarias.usuario_id, usuario_id)).limit(1);
      if (guias.length || ventas.length) throw new ErrorAcceso(409, "El usuario tiene historial. Desactiva su cuenta desde Editar para conservar los registros.");
      await tx.delete(esquema.usuarios).where(eq(esquema.usuarios.id, usuario_id));
    });
  }
  type Transaccion = Parameters<Parameters<typeof db.transaction>[0]>[0];
  async function comprobar_actor(tx: Transaccion, actor: UsuarioSesion) {
    const [actual] = await tx.select().from(esquema.usuarios).where(eq(esquema.usuarios.id, actor.id));
    if (!actual?.activo || actual.version_sesion !== actor.version_sesion) throw new ErrorAcceso(401, "Tu sesion ya no es valida. Inicia sesion nuevamente.");
    if (actual.rol !== "superadmin") throw new ErrorAcceso(403, "No tienes permiso para gestionar usuarios.");
  }
  async function proteger_ultimo(tx: Transaccion) {
    const activos = await tx.select({ id: esquema.usuarios.id }).from(esquema.usuarios).where(and(eq(esquema.usuarios.rol, "superadmin"), eq(esquema.usuarios.activo, true)));
    if (activos.length <= 1) throw new ErrorAcceso(409, "Debe permanecer al menos un superadmin activo.");
  }
  return { listar, guardar, eliminar };
}
