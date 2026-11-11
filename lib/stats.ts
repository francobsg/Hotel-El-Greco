import "server-only";

import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import type * as esquema from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { obtener_db } from "@/lib/db";
import { filtros_panel, preparar_graficos, restar_dias, type FilaHistorico, type FiltrosPanel, type ResumenPanel } from "@/lib/stats/tipos";

function filas_resultado<Fila>(resultado: unknown): Fila[] {
  if (Array.isArray(resultado)) return resultado as Fila[];
  if (resultado && typeof resultado === "object" && "rows" in resultado && Array.isArray(resultado.rows)) return resultado.rows as Fila[];
  throw new Error("Respuesta inesperada de PostgreSQL.");
}

export function crear_servicio_stats<Resultado extends PgQueryResultHKT>(db: PgDatabase<Resultado, typeof esquema>) {
  async function resumen_panel(input: FiltrosPanel): Promise<ResumenPanel> {
    const { fecha, bodega } = filtros_panel.parse(input);
    const resultado = await db.execute(sql`
      with saldos as (
        select producto_id, bodega_id, sum(cantidad) as cantidad from movimientos
        where fecha <= ${fecha}::date and (${bodega}::integer is null or bodega_id = ${bodega})
        group by producto_id, bodega_id
      ), alertas as (
        select p.id as producto_id, b.id as bodega_id, p.nombre as producto,
          b.nombre as bodega, p.unidad, coalesce(s.cantidad, 0) as cantidad,
          case when coalesce(s.cantidad, 0) < p.stock_critico then 'critico' else 'bajo' end as estado,
          coalesce(s.cantidad, 0) / nullif(p.stock_minimo, 0) as proporcion
        from productos p cross join bodegas b
        left join saldos s on s.producto_id = p.id and s.bodega_id = b.id
        where (${bodega}::integer is null or b.id = ${bodega}) and coalesce(s.cantidad, 0) < p.stock_minimo
      )
      select jsonb_build_object(
        'kpis', jsonb_build_object(
          'productos', (select count(*) from productos),
          'usuarios', (select count(*) from usuarios),
          'alertas', (select count(distinct producto_id) from alertas),
          'movimientos', (select count(*) from movimientos where fecha = ${fecha}::date and (${bodega}::integer is null or bodega_id = ${bodega}))
        ),
        'total_alertas', (select count(*) from alertas),
        'alertas', coalesce((select jsonb_agg(to_jsonb(a) - 'proporcion') from (
          select producto_id, bodega_id, producto, bodega, unidad, cantidad::text, estado, proporcion
          from alertas order by case when estado = 'critico' then 0 else 1 end, proporcion, producto_id, bodega_id limit 5
        ) a), '[]'::jsonb),
        'movimientos', coalesce((select jsonb_agg(to_jsonb(m)) from (
          select m.id, p.nombre as producto, b.nombre as bodega, g.tipo, m.cantidad::text, p.unidad, m.fecha::text
          from movimientos m join productos p on p.id = m.producto_id
          join bodegas b on b.id = m.bodega_id join guias g on g.id = m.guia_id
          where m.fecha <= ${fecha}::date and (${bodega}::integer is null or m.bodega_id = ${bodega})
          order by m.fecha desc, m.id desc limit 5
        ) m), '[]'::jsonb)
      ) as datos
    `);
    return filas_resultado<{ datos: ResumenPanel }>(resultado)[0].datos;
  }

  async function stock_historico(input: FiltrosPanel) {
    const { fecha, dias } = filtros_panel.parse(input);
    const desde = restar_dias(fecha, dias - 1);
    // Una sola lectura del libro de movimientos. El pasado se compacta a un saldo
    // inicial por categoria/unidad; solo el periodo solicitado conserva dias.
    const resultado = await db.execute(sql`
      with variaciones as (
        select c.id as categoria_id, c.nombre as categoria, c.grupo_grafico as grupo, p.unidad,
          case when m.fecha < ${desde}::date then null else m.fecha end as fecha,
          sum(m.cantidad) as cantidad
        from movimientos m join productos p on p.id = m.producto_id join categorias c on c.id = p.categoria_id
        where m.bodega_id = 2 and m.fecha <= ${fecha}::date
          and c.grupo_grafico in ('Carnes', 'Pastas y arroz', 'Verduras y frutas', 'Lácteos y huevos')
        group by 1, 2, 3, 4, 5
      ), series as (
        select distinct categoria_id, categoria, grupo, unidad from variaciones
      ), calendario as (
        select generate_series(${desde}::timestamp, ${fecha}::timestamp, interval '1 day')::date as fecha
      )
      select s.categoria_id, s.categoria, s.grupo, s.unidad, d.fecha::text,
        (coalesce(inicial.cantidad, 0) + sum(coalesce(v.cantidad, 0)) over (
          partition by s.categoria_id, s.unidad order by d.fecha rows between unbounded preceding and current row
        ))::text as cantidad
      from series s cross join calendario d
      left join variaciones inicial on inicial.categoria_id = s.categoria_id and inicial.unidad = s.unidad and inicial.fecha is null
      left join variaciones v on v.categoria_id = s.categoria_id and v.unidad = s.unidad and v.fecha = d.fecha
      order by s.grupo, s.categoria_id, s.unidad, d.fecha
    `);
    return preparar_graficos(filas_resultado<FilaHistorico>(resultado));
  }
  async function inventario(input: FiltrosPanel, solo_alertas = false) {
    const { fecha, bodega } = filtros_panel.parse(input);
    const resultado = await db.execute(sql`
      with saldos as (
        select producto_id, bodega_id, sum(cantidad) as cantidad from movimientos
        where fecha <= ${fecha}::date and (${bodega}::integer is null or bodega_id = ${bodega}) group by producto_id, bodega_id
      )
      select p.id as producto_id, b.id as bodega_id, p.nombre as producto, b.nombre as bodega, p.unidad,
        coalesce(s.cantidad, 0)::text as cantidad,
        case when coalesce(s.cantidad, 0) < p.stock_critico then 'critico'
          when coalesce(s.cantidad, 0) < p.stock_minimo then 'bajo' else 'normal' end as estado
      from productos p cross join bodegas b left join saldos s on s.producto_id = p.id and s.bodega_id = b.id
      where (${bodega}::integer is null or b.id = ${bodega}) and (not ${solo_alertas}::boolean or coalesce(s.cantidad, 0) < p.stock_minimo)
      order by p.nombre, b.id
    `);
    return filas_resultado<Omit<ResumenPanel["alertas"][number], "estado"> & { estado: "normal" | "bajo" | "critico" }>(resultado);
  }
  async function historial(input: FiltrosPanel, pagina = 1) {
    const { fecha, bodega } = filtros_panel.parse(input);
    const resultado = await db.execute(sql`
      select m.id, p.nombre as producto, b.nombre as bodega, g.tipo, m.cantidad::text, p.unidad, m.fecha::text
      from movimientos m join productos p on p.id = m.producto_id join bodegas b on b.id = m.bodega_id join guias g on g.id = m.guia_id
      where m.fecha <= ${fecha}::date and (${bodega}::integer is null or m.bodega_id = ${bodega})
      order by m.fecha desc, m.id desc limit 51 offset ${(pagina - 1) * 50}
    `);
    const filas = filas_resultado<ResumenPanel["movimientos"][number]>(resultado);
    return { filas: filas.slice(0, 50), hay_mas: filas.length > 50 };
  }
  return { resumen_panel, stock_historico, inventario, historial };
}

export async function obtener_panel(filtros: FiltrosPanel) {
  await requireRole("superadmin", "admin");
  const servicio = crear_servicio_stats(obtener_db());
  const [resumen, graficos] = await Promise.all([servicio.resumen_panel(filtros), servicio.stock_historico(filtros)]);
  return { resumen, graficos };
}

export async function obtener_stock_historico(filtros: FiltrosPanel) {
  await requireRole("superadmin", "admin");
  return crear_servicio_stats(obtener_db()).stock_historico(filtros);
}

export async function obtener_inventario(filtros: FiltrosPanel, solo_alertas: boolean) {
  await requireRole("superadmin", "admin");
  return crear_servicio_stats(obtener_db()).inventario(filtros, solo_alertas);
}
export async function obtener_historial(filtros: FiltrosPanel, pagina: number) {
  await requireRole("superadmin", "admin");
  return crear_servicio_stats(obtener_db()).historial(filtros, pagina);
}
