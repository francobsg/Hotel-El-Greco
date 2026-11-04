import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as esquema from "@/db/schema";
import type { UsuarioSesion } from "@/lib/auth/permisos";
import { ErrorAcceso, validar_rol } from "@/lib/auth/servicio";
import { nuevo_producto } from "@/lib/inventario/tipos";
// Alta de una ficha sin stock desde la confirmacion del escaner. No concede
// al trabajador acceso a las mutaciones generales de inventario.
export function crear_servicio_productos_escaner<Resultado extends PgQueryResultHKT>(db: PgDatabase<Resultado, typeof esquema>) {
  return async (actor: UsuarioSesion, input: unknown) => {
    validar_rol(actor, ["superadmin", "trabajador"], true);
    const producto = nuevo_producto.parse(input);
    if ([producto.stock_critico, producto.stock_minimo, producto.stock_maximo, producto.costo].some((valor) => Number(valor) !== 0)) throw new ErrorAcceso(400, "La ficha del escáner se crea sin stock, niveles ni costo.");
    return db.transaction(async (tx) => {
      const [usuario] = await tx.select().from(esquema.usuarios).where(eq(esquema.usuarios.id, actor.id)).for("share");
      if (!usuario?.activo || usuario.version_sesion !== actor.version_sesion) throw new ErrorAcceso(401, "Tu sesión ya no es válida.");
      if (!["superadmin", "trabajador"].includes(usuario.rol)) throw new ErrorAcceso(403, "No puedes crear productos desde el escáner.");
      const [categoria] = await tx.select({ id: esquema.categorias.id }).from(esquema.categorias).where(eq(esquema.categorias.id, producto.categoria_id)).for("share");
      if (!categoria) throw new ErrorAcceso(400, "Selecciona una categoría válida.");
      const [creado] = await tx.insert(esquema.productos).values(producto).returning({ id: esquema.productos.id, nombre: esquema.productos.nombre });
      return creado;
    });
  };
}
