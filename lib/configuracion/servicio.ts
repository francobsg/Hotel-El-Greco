import { eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";
import * as e from "@/db/schema";
import type { UsuarioSesion } from "@/lib/auth/permisos";
import { ErrorAcceso, validar_rol } from "@/lib/auth/servicio";
import { filas_sql } from "@/lib/analisis/servicio";
export const recursos = ["niveles", "categorias", "platillos", "recetas"] as const;
export type RecursoConfiguracion = typeof recursos[number];
export type FilaConfiguracion = { id: number; nombre: string; stock_critico?: string; stock_minimo?: string; stock_maximo?: string; grupo_grafico?: string | null; precio?: string | null; activo?: boolean; platillo_id?: number; producto_id?: number; gramos_o_ml?: string; producto?: string; unidad?: string };
const decimal = z.string().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/);
const id = z.number().int().positive().max(2147483647);
export const niveles = z.object({ stock_critico: decimal, stock_minimo: decimal, stock_maximo: decimal }).strict().refine((d) => Number(d.stock_critico) <= Number(d.stock_minimo) && Number(d.stock_minimo) <= Number(d.stock_maximo), "Cumple Crítico ≤ Mínimo ≤ Máximo.");
export const categoria = z.object({ nombre: z.string().trim().min(2).max(100), grupo_grafico: z.string().trim().max(100).nullable() }).strict();
export const platillo = z.object({ nombre: z.string().trim().min(2).max(150), precio: z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/).nullable(), activo: z.boolean() }).strict();
export const receta = z.object({ platillo_id: id, producto_id: id, gramos_o_ml: decimal.refine((s) => Number(s) > 0 && Number.isInteger(Number(s)), "Usa gramos/ml enteros positivos para descontar a precisión 0,001 kg/lt.") }).strict();
export function crear_servicio_configuracion<R extends PgQueryResultHKT>(db: PgDatabase<R, typeof e>) {
  async function listar(recurso: RecursoConfiguracion, pagina = 1, buscar = "") {
    z.enum(recursos).parse(recurso); z.number().int().min(1).max(100000).parse(pagina); z.string().max(150).parse(buscar);
    const patron = `%${buscar.replace(/[\\%_]/g, "\\$&")}%`;
    const consulta = recurso === "recetas" ? sql`select r.id, p.nombre, r.platillo_id, r.producto_id, r.gramos_o_ml::text, pr.nombre as producto, pr.unidad from recetas r join platillos p on p.id = r.platillo_id join productos pr on pr.id = r.producto_id where p.nombre ilike ${patron} or pr.nombre ilike ${patron}`
      : recurso === "niveles" ? sql`select id, nombre, unidad, stock_critico::text, stock_minimo::text, stock_maximo::text from productos where nombre ilike ${patron}`
      : recurso === "categorias" ? sql`select id, nombre, grupo_grafico from categorias where nombre ilike ${patron}`
      : sql`select id, nombre, precio::text, activo from platillos where nombre ilike ${patron}`;
    const resultado = await db.execute(sql`with seleccion as (${consulta}), conteo as (select count(*)::integer as total from seleccion)
      select jsonb_build_object('total', total, 'pagina', least(${pagina}, greatest(1, ceil(total::numeric / 50)::integer)), 'filas', coalesce((select jsonb_agg(to_jsonb(f)) from (
      select * from seleccion order by nombre, id limit 50 offset ((least(${pagina}, greatest(1, ceil(total::numeric / 50)::integer)) - 1) * 50)
      ) f), '[]'::jsonb)) as datos from conteo`);
    return filas_sql<{ datos: { filas: FilaConfiguracion[]; total: number; pagina: number } }>(resultado)[0].datos;
  }
  async function modificar(actor: UsuarioSesion, recurso: RecursoConfiguracion, input: unknown, registro_id?: number, eliminar = false) {
    validar_rol(actor, ["superadmin"], true); z.enum(recursos).parse(recurso); if (registro_id) id.parse(registro_id);
    return db.transaction(async (tx) => {
      const [actual] = await tx.select().from(e.usuarios).where(eq(e.usuarios.id, actor.id)).for("share");
      if (!actual?.activo || actual.version_sesion !== actor.version_sesion) throw new ErrorAcceso(401, "Tu sesión ya no es válida.");
      if (actual.rol !== "superadmin") throw new ErrorAcceso(403, "Solo superadmin puede modificar la configuración.");
      // Serializa cambios de catalogos y referencias, ademas de las restricciones de la BD.
      await tx.execute(sql`select pg_advisory_xact_lock(707, 9)`);
      if (recurso === "niveles") {
        if (!registro_id || eliminar) throw new ErrorAcceso(400, "Los niveles se actualizan por producto, sin editar stock.");
        const filas = await tx.update(e.productos).set(niveles.parse(input)).where(eq(e.productos.id, registro_id)).returning({ id: e.productos.id });
        if (!filas.length) throw new ErrorAcceso(404, "Producto no encontrado."); return filas[0];
      }
      if (recurso === "categorias") {
        if (eliminar) {
          if (!registro_id) throw new ErrorAcceso(400, "Selecciona una categoría.");
          const [uso] = await tx.select({ id: e.productos.id }).from(e.productos).where(eq(e.productos.categoria_id, registro_id)).limit(1);
          if (uso) throw new ErrorAcceso(409, "La categoría tiene productos. Reasígnalos antes de eliminarla.");
          const borrados = await tx.delete(e.categorias).where(eq(e.categorias.id, registro_id)).returning({ id: e.categorias.id });
          if (!borrados.length) throw new ErrorAcceso(404, "Categoría no encontrada."); return borrados[0];
        }
        const datos = categoria.parse(input);
        const [repetido] = await tx.select({ id: e.categorias.id }).from(e.categorias).where(sql`lower(${e.categorias.nombre}) = lower(${datos.nombre})`);
        if (repetido && repetido.id !== registro_id) throw new ErrorAcceso(409, "Ya existe esa categoría.");
        const filas = registro_id ? await tx.update(e.categorias).set(datos).where(eq(e.categorias.id, registro_id)).returning({ id: e.categorias.id }) : await tx.insert(e.categorias).values(datos).returning({ id: e.categorias.id });
        if (!filas.length) throw new ErrorAcceso(404, "Categoría no encontrada."); return filas[0];
      }
      if (recurso === "platillos") {
        if (eliminar) {
          if (!registro_id) throw new ErrorAcceso(400, "Selecciona un platillo.");
          const [temporal] = await tx.select({ id: e.ventas_temporales.id }).from(e.ventas_temporales).where(eq(e.ventas_temporales.platillo_id, registro_id)).limit(1);
          const [diaria] = await tx.select({ id: e.ventas_diarias_items.id }).from(e.ventas_diarias_items).where(eq(e.ventas_diarias_items.platillo_id, registro_id)).limit(1);
          if (temporal || diaria) throw new ErrorAcceso(409, "El platillo tiene ventas. Desactívalo para conservar su historial.");
          await tx.delete(e.recetas).where(eq(e.recetas.platillo_id, registro_id));
          const filas = await tx.delete(e.platillos).where(eq(e.platillos.id, registro_id)).returning({ id: e.platillos.id });
          if (!filas.length) throw new ErrorAcceso(404, "Platillo no encontrado."); return filas[0];
        }
        const datos = platillo.parse(input);
        const [repetido] = await tx.select({ id: e.platillos.id }).from(e.platillos).where(sql`lower(${e.platillos.nombre}) = lower(${datos.nombre})`);
        if (repetido && repetido.id !== registro_id) throw new ErrorAcceso(409, "Ya existe ese platillo.");
        const filas = registro_id ? await tx.update(e.platillos).set(datos).where(eq(e.platillos.id, registro_id)).returning({ id: e.platillos.id }) : await tx.insert(e.platillos).values(datos).returning({ id: e.platillos.id });
        if (!filas.length) throw new ErrorAcceso(404, "Platillo no encontrado."); return filas[0];
      }
      if (eliminar) {
        if (!registro_id) throw new ErrorAcceso(400, "Selecciona una receta.");
        const filas = await tx.delete(e.recetas).where(eq(e.recetas.id, registro_id)).returning({ id: e.recetas.id });
        if (!filas.length) throw new ErrorAcceso(404, "Receta no encontrada."); return filas[0];
      }
      const datos = receta.parse(input);
      const [producto] = await tx.select().from(e.productos).where(eq(e.productos.id, datos.producto_id)).for("share");
      const [plato] = await tx.select().from(e.platillos).where(eq(e.platillos.id, datos.platillo_id)).for("share");
      if (!producto || !plato) throw new ErrorAcceso(400, "Selecciona un producto y un platillo existentes.");
      if (!["kg", "lt"].includes(producto.unidad)) throw new ErrorAcceso(422, "Productos en un/caja necesitan una equivalencia definida; selecciona kg o lt.");
      const [repetido] = await tx.select({ id: e.recetas.id }).from(e.recetas).where(sql`${e.recetas.producto_id} = ${datos.producto_id} and ${e.recetas.platillo_id} = ${datos.platillo_id}`);
      if (repetido && repetido.id !== registro_id) throw new ErrorAcceso(409, "Ese ingrediente ya está en la receta. Edita su cantidad.");
      const filas = registro_id ? await tx.update(e.recetas).set(datos).where(eq(e.recetas.id, registro_id)).returning({ id: e.recetas.id }) : await tx.insert(e.recetas).values(datos).returning({ id: e.recetas.id });
      if (!filas.length) throw new ErrorAcceso(404, "Receta no encontrada."); return filas[0];
    });
  }
  return { listar, modificar };
}
