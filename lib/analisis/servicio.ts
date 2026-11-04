import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as esquema from "@/db/schema";
import { fecha_chile, restar_dias } from "@/lib/stats/tipos";
import { limites_mes, periodo_reporte, rango_estadisticas, type DatosEstadisticas, type MovimientoReporte, type PrediccionProducto, type ResumenReporte } from "./tipos";
import { z } from "zod";
export function filas_sql<T>(resultado: unknown): T[] {
  if (Array.isArray(resultado)) return resultado as T[];
  if (resultado && typeof resultado === "object" && "rows" in resultado && Array.isArray(resultado.rows)) return resultado.rows as T[];
  throw new Error("Respuesta inesperada de PostgreSQL.");
}
export function crear_servicio_analisis<R extends PgQueryResultHKT>(db: PgDatabase<R, typeof esquema>) {
  async function movimientos_mes(input: z.input<typeof periodo_reporte>, despues = 0) {
    const { mes, ano, bodega } = periodo_reporte.parse(input); const { inicio, fin } = limites_mes(ano, mes);
    const resultado = await db.execute(sql`with items as (
      select i.*, row_number() over (partition by i.guia_id, i.producto_id order by i.id) as orden
      from guia_items i join guias g on g.id = i.guia_id where g.fecha >= ${inicio}::date and g.fecha < ${fin}::date
    ), movimientos_mes as (
      select m.*, row_number() over (partition by m.guia_id, m.producto_id order by m.id) as orden
      from movimientos m where m.bodega_id = ${bodega} and m.fecha >= ${inicio}::date and m.fecha < ${fin}::date
    ) select m.id, m.fecha::text, g.folio, g.tipo, p.nombre as producto, m.cantidad::text, p.unidad,
      g.n_factura, i.marca, u.nombre as usuario, g.provisional
      from movimientos_mes m join guias g on g.id = m.guia_id join productos p on p.id = m.producto_id
      join usuarios u on u.id = g.usuario_id left join items i on i.guia_id = m.guia_id and i.producto_id = m.producto_id and i.orden = m.orden
      where m.id > ${despues} order by m.id limit 1000`);
    return filas_sql<MovimientoReporte>(resultado);
  }
  async function resumen_mes(input: z.input<typeof periodo_reporte>) {
    const { mes, ano, bodega } = periodo_reporte.parse(input); const { inicio, fin } = limites_mes(ano, mes);
    const resultado = await db.execute(sql`with saldos as (
      select producto_id, coalesce(sum(cantidad) filter (where fecha < ${inicio}::date), 0) as inicial,
      coalesce(sum(cantidad) filter (where fecha >= ${inicio}::date and cantidad > 0), 0) as entradas,
      coalesce(-sum(cantidad) filter (where fecha >= ${inicio}::date and cantidad < 0), 0) as salidas, sum(cantidad) as final
      from movimientos where bodega_id = ${bodega} and fecha < ${fin}::date group by producto_id
    ) select p.id, p.nombre as producto, p.unidad, coalesce(s.inicial, 0)::text as inicial,
      coalesce(s.entradas, 0)::text as entradas, coalesce(s.salidas, 0)::text as salidas, coalesce(s.final, 0)::text as final
      from productos p left join saldos s on s.producto_id = p.id order by p.nombre, p.id`);
    return filas_sql<ResumenReporte>(resultado);
  }
  async function estadisticas(input: z.input<typeof rango_estadisticas>): Promise<DatosEstadisticas> {
    const { inicio, fin, bodega, unidad } = rango_estadisticas.parse(input);
    const resultado = await db.execute(sql`with periodo as (
      select m.*, g.tipo, p.nombre, p.categoria_id from movimientos m join guias g on g.id = m.guia_id
      join productos p on p.id = m.producto_id where m.bodega_id = ${bodega} and m.fecha between ${inicio}::date and ${fin}::date and p.unidad = ${unidad}
    ), consumo as (select * from periodo where cantidad < 0 and tipo in ('consumo', 'venta', 'salida')),
    saldos as (select producto_id, coalesce(sum(cantidad) filter (where fecha < ${inicio}::date), 0) as inicial, sum(cantidad) as final
      from movimientos where bodega_id = ${bodega} and fecha <= ${fin}::date group by producto_id),
    usos as (select producto_id, nombre, -sum(cantidad) as cantidad, count(distinct fecha)::integer as dias from consumo group by producto_id, nombre)
    select jsonb_build_object(
      'categorias', coalesce((select jsonb_agg(to_jsonb(c)) from (select c.nombre, (-sum(m.cantidad))::float8 as cantidad from consumo m join categorias c on c.id = m.categoria_id group by c.id order by cantidad desc) c), '[]'::jsonb),
      'usados', coalesce((select jsonb_agg(to_jsonb(u)) from (select nombre, dias, cantidad::float8 from usos order by dias desc, cantidad desc limit 10) u), '[]'::jsonb),
      'rotacion', coalesce((select jsonb_agg(to_jsonb(r)) from (select u.producto_id as id, u.nombre, u.cantidad::float8 as consumo, ((s.inicial + s.final) / 2)::float8 as promedio,
        (u.cantidad / nullif((s.inicial + s.final) / 2, 0))::float8 as rotacion from usos u join saldos s on s.producto_id = u.producto_id order by rotacion desc nulls last limit 50) r), '[]'::jsonb),
      'semanas', coalesce((select jsonb_agg(to_jsonb(s)) from (select date_trunc('week', fecha)::date::text as fecha,
        coalesce(sum(cantidad) filter (where cantidad > 0), 0)::float8 as entradas, coalesce(-sum(cantidad) filter (where cantidad < 0), 0)::float8 as salidas
        from periodo group by 1 order by 1) s), '[]'::jsonb),
      'ventas', coalesce((select jsonb_agg(to_jsonb(v)) from (select p.nombre, sum(v.cantidad)::integer as cantidad from ventas_temporales v join platillos p on p.id = v.platillo_id
        where v.fecha between ${inicio}::date and ${fin}::date group by p.id order by cantidad desc limit 20) v), '[]'::jsonb)
    ) as datos`);
    return filas_sql<{ datos: DatosEstadisticas }>(resultado)[0].datos;
  }
  async function prediccion(input: { bodega: number; pagina: number; buscar: string }) {
    const { bodega, pagina, buscar } = z.object({ bodega: z.union([z.literal(1), z.literal(2)]), pagina: z.number().int().min(1).max(100000), buscar: z.string().trim().max(150) }).parse(input);
    const hoy = fecha_chile(), inicio = restar_dias(hoy, 29), patron = `%${buscar.replace(/[\\%_]/g, "\\$&")}%`;
    const resultado = await db.execute(sql`with saldos as (
      select m.producto_id, sum(m.cantidad) as stock,
        coalesce(-sum(m.cantidad) filter (where m.fecha >= ${inicio}::date and m.cantidad < 0 and g.tipo in ('consumo', 'venta', 'salida')), 0) / 30 as promedio
      from movimientos m join guias g on g.id = m.guia_id where m.bodega_id = ${bodega} and m.fecha <= ${hoy}::date group by m.producto_id
    ), estimaciones as (select p.id, p.nombre, p.unidad, coalesce(s.stock, 0)::float8 as stock, coalesce(s.promedio, 0)::float8 as promedio,
      (s.stock / nullif(s.promedio, 0))::float8 as dias,
      case when coalesce(s.stock, 0) < p.stock_minimo or s.stock / nullif(s.promedio, 0) < 7
        then (ceil(greatest(0, greatest(p.stock_minimo, least(case when p.stock_maximo > 0 then p.stock_maximo else greatest(p.stock_minimo, coalesce(s.promedio, 0) * 14) end, greatest(p.stock_minimo, coalesce(s.promedio, 0) * 14))) - coalesce(s.stock, 0)) * 1000) / 1000)::float8 else 0 end as reponer
      from productos p left join saldos s on s.producto_id = p.id where p.nombre ilike ${patron}
    ) select jsonb_build_object('total', (select count(*)::integer from estimaciones), 'filas', coalesce((select jsonb_agg(to_jsonb(e)) from (
      select * from estimaciones order by dias asc nulls last, nombre, id limit 50 offset ${(pagina - 1) * 50}
    ) e), '[]'::jsonb)) as datos`);
    return filas_sql<{ datos: { filas: PrediccionProducto[]; total: number } }>(resultado)[0].datos;
  }
  return { movimientos_mes, resumen_mes, estadisticas, prediccion };
}
