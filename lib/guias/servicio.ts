import { eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as esquema from "@/db/schema";
import { ErrorAcceso } from "@/lib/auth/servicio";
import type { DetalleGuia, FiltrosHistorial, GuiaListado, PaginaGuias } from "./tipos";
function filas<Fila>(resultado: unknown): Fila[] {
  if (Array.isArray(resultado)) return resultado as Fila[];
  if (resultado && typeof resultado === "object" && "rows" in resultado && Array.isArray(resultado.rows)) return resultado.rows as Fila[];
  throw new Error("Respuesta inesperada de PostgreSQL.");
}
export function crear_servicio_guias<Resultado extends PgQueryResultHKT>(db: PgDatabase<Resultado, typeof esquema>) {
  const columnas = sql`g.id, g.folio, g.tipo, g.provisional, g.fecha::text, o.nombre as origen, d.nombre as destino,
    g.glosa, u.nombre as usuario, g.usuario_id, g.n_factura,
    (select count(*)::integer from guia_items i where i.guia_id = g.id) as total_items,
    coalesce((select string_agg(p.nombre || ': ' || i.cantidad::text || ' ' || p.unidad, ' · ' order by i.id)
      from guia_items i join productos p on p.id = i.producto_id where i.guia_id = g.id), '') as resumen_items`;
  const uniones = sql`from guias g join usuarios u on u.id = g.usuario_id left join bodegas o on o.id = g.bodega_origen_id left join bodegas d on d.id = g.bodega_destino_id`;
  async function listar(filtros: FiltrosHistorial, completo = false): Promise<PaginaGuias> {
    const patron = `%${filtros.folio.replace(/[\\%_]/g, "\\$&")}%`;
    const resultado = await db.execute(sql`
      with seleccionadas as (
        select g.* from guias g where (g.folio ilike ${patron} or coalesce(g.n_factura, '') ilike ${patron})
          and (${filtros.inicio}::date is null or g.fecha >= ${filtros.inicio}::date)
          and (${filtros.fin}::date is null or g.fecha <= ${filtros.fin}::date)
          and (${filtros.tipo}::text is null or g.tipo::text = ${filtros.tipo})
          and (${filtros.bodega}::integer is null or g.bodega_origen_id = ${filtros.bodega} or g.bodega_destino_id = ${filtros.bodega})
      ), conteo as (select count(*)::integer as total from seleccionadas), paginacion as (
        select total, greatest(1, ceil(total::numeric / 50)::integer) as paginas,
          least(${filtros.pagina}, greatest(1, ceil(total::numeric / 50)::integer)) as pagina from conteo
      ), pagina_guias as (select * from seleccionadas order by fecha desc, id desc
        limit ${completo ? sql`null` : sql`50`} offset ${completo ? sql`0` : sql`(select (pagina - 1)::bigint * 50 from paginacion)`})
      select jsonb_build_object('total', total, 'paginas', paginas, 'pagina', pagina,
        'filas', coalesce((select jsonb_agg(to_jsonb(fila)) from (
          select ${columnas} from pagina_guias g join usuarios u on u.id = g.usuario_id
          left join bodegas o on o.id = g.bodega_origen_id left join bodegas d on d.id = g.bodega_destino_id
          order by g.fecha desc, g.id desc
        ) fila), '[]'::jsonb)) as datos from paginacion
    `);
    return filas<{ datos: PaginaGuias }>(resultado)[0].datos;
  }
  async function detalle(folio: string, propietario?: number): Promise<DetalleGuia> {
    const resultado = await db.execute(sql`select ${columnas}, g.imagen_factura_url, g.creado_en::text ${uniones} where g.folio = ${folio} and (${propietario ?? null}::integer is null or g.usuario_id = ${propietario ?? null})`);
    const guia = filas<GuiaListado & { imagen_factura_url: string | null; creado_en: string }>(resultado)[0];
    if (!guia) throw new ErrorAcceso(404, "Guía no encontrada.");
    const items = await db.select({ id: esquema.guia_items.id, producto_id: esquema.guia_items.producto_id, producto: esquema.productos.nombre, unidad: esquema.productos.unidad, cantidad: esquema.guia_items.cantidad, marca: esquema.guia_items.marca, descripcion: esquema.guia_items.descripcion }).from(esquema.guia_items).innerJoin(esquema.productos, eq(esquema.productos.id, esquema.guia_items.producto_id)).where(eq(esquema.guia_items.guia_id, guia.id)).orderBy(esquema.guia_items.id);
    return { ...guia, items };
  }
  return { listar, detalle };
}
