import { desc, eq, lte, and, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as esquema from "@/db/schema";
import { ErrorAcceso, validar_rol } from "@/lib/auth/servicio";
import type { UsuarioSesion } from "@/lib/auth/permisos";
import { nuevo_producto, type DetalleProducto, type FiltrosInventario, type PaginaInventario } from "./tipos";

function filas_resultado<Fila>(resultado: unknown): Fila[] {
  if (Array.isArray(resultado)) return resultado as Fila[];
  if (resultado && typeof resultado === "object" && "rows" in resultado && Array.isArray(resultado.rows)) return resultado.rows as Fila[];
  throw new Error("Respuesta inesperada de PostgreSQL.");
}
export function crear_servicio_inventario<Resultado extends PgQueryResultHKT>(db: PgDatabase<Resultado, typeof esquema>) {
  async function listar(filtros: FiltrosInventario, completo = false, producto_id: number | null = null): Promise<PaginaInventario> {
    const patron = `%${filtros.buscar.replace(/[\\%_]/g, "\\$&")}%`;
    // Conteo, pagina y saldos comparten la misma instantanea SQL. Se agregan
    // movimientos una vez, antes de unir el catalogo (incluye productos sin stock).
    const resultado = await db.execute(sql`
      with saldos as (
        select producto_id, coalesce(sum(cantidad) filter (where bodega_id = 1), 0) as stock_1,
          coalesce(sum(cantidad) filter (where bodega_id = 2), 0) as stock_2
        from movimientos where fecha <= ${filtros.fecha}::date group by producto_id
      ), catalogo as (
        select p.id, p.nombre, p.categoria_id, c.nombre as categoria, p.unidad, p.marca,
          p.stock_critico::text, p.stock_minimo::text, p.stock_maximo::text, p.costo::text,
          coalesce(s.stock_1, 0)::text as stock_1, coalesce(s.stock_2, 0)::text as stock_2
        from productos p join categorias c on c.id = p.categoria_id left join saldos s on s.producto_id = p.id
        where (${producto_id}::integer is null or p.id = ${producto_id})
          and (p.nombre ilike ${patron} or c.nombre ilike ${patron} or coalesce(p.marca, '') ilike ${patron})
          and (${filtros.alertas} = false or
            ((${filtros.bodega}::integer is null or ${filtros.bodega} = 1) and coalesce(s.stock_1, 0) < p.stock_minimo) or
            ((${filtros.bodega}::integer is null or ${filtros.bodega} = 2) and coalesce(s.stock_2, 0) < p.stock_minimo))
      ), conteo as (select count(*)::integer as total from catalogo), paginacion as (
        select total, greatest(1, ceil(total::numeric / ${filtros.registros})::integer) as paginas,
          least(${filtros.pagina}, greatest(1, ceil(total::numeric / ${filtros.registros})::integer)) as pagina from conteo
      )
      select jsonb_build_object('total', total, 'paginas', paginas, 'pagina', pagina,
        'filas', coalesce((select jsonb_agg(to_jsonb(fila)) from (
          select * from catalogo order by lower(nombre), id
          limit ${completo ? sql`null` : sql`${filtros.registros}`}
          offset ${completo ? sql`0` : sql`(select (pagina - 1)::bigint * ${filtros.registros} from paginacion)`}
        ) fila), '[]'::jsonb)) as datos from paginacion
    `);
    return filas_resultado<{ datos: PaginaInventario }>(resultado)[0].datos;
  }
  async function detalle(id: number, filtros: FiltrosInventario): Promise<DetalleProducto> {
    const pagina = await listar({ ...filtros, buscar: "", alertas: false }, false, id);
    if (!pagina.filas.length) throw new ErrorAcceso(404, "Producto no encontrado.");
    const movimientos = await db.select({ id: esquema.movimientos.id, folio: esquema.guias.folio, tipo: esquema.guias.tipo, bodega: esquema.bodegas.nombre, cantidad: esquema.movimientos.cantidad, fecha: esquema.movimientos.fecha }).from(esquema.movimientos)
      .innerJoin(esquema.guias, eq(esquema.guias.id, esquema.movimientos.guia_id)).innerJoin(esquema.bodegas, eq(esquema.bodegas.id, esquema.movimientos.bodega_id))
      .where(and(eq(esquema.movimientos.producto_id, id), lte(esquema.movimientos.fecha, filtros.fecha))).orderBy(desc(esquema.movimientos.fecha), desc(esquema.movimientos.id)).limit(10);
    return { producto: pagina.filas[0], movimientos };
  }
  async function guardar(actor: UsuarioSesion, input: unknown) {
    validar_rol(actor, ["superadmin"], true);
    const datos = nuevo_producto.parse(input);
    return db.transaction(async (tx) => {
      const [actual] = await tx.select().from(esquema.usuarios).where(eq(esquema.usuarios.id, actor.id)).for("share");
      if (!actual?.activo || actual.version_sesion !== actor.version_sesion) throw new ErrorAcceso(401, "Tu sesión ya no es válida.");
      if (actual.rol !== "superadmin") throw new ErrorAcceso(403, "Solo superadmin puede crear productos.");
      const [categoria] = await tx.select({ id: esquema.categorias.id }).from(esquema.categorias).where(eq(esquema.categorias.id, datos.categoria_id)).for("share");
      if (!categoria) throw new ErrorAcceso(400, "Selecciona una categoría válida.");
      const [creado] = await tx.insert(esquema.productos).values(datos).returning({ id: esquema.productos.id, nombre: esquema.productos.nombre });
      return creado;
    });
  }
  async function categorias() { return db.select({ id: esquema.categorias.id, nombre: esquema.categorias.nombre }).from(esquema.categorias).orderBy(esquema.categorias.nombre); }
  return { listar, detalle, guardar, categorias };
}
