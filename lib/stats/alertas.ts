import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";

import type * as esquema from "@/db/schema";
import { ErrorAcceso, validar_rol } from "@/lib/auth/servicio";
import type { UsuarioSesion } from "@/lib/auth/permisos";

const entrada_alerta = z.object({
  producto_id: z.number().int().positive(),
  bodega_id: z.union([z.literal(1), z.literal(2)]),
  accion: z.literal("ignorar"),
}).strict();

function filas_resultado(resultado: unknown): { producto_id: number }[] {
  if (Array.isArray(resultado)) return resultado as { producto_id: number }[];
  if (resultado && typeof resultado === "object" && "rows" in resultado && Array.isArray(resultado.rows)) return resultado.rows as { producto_id: number }[];
  throw new Error("Respuesta inesperada de PostgreSQL.");
}

export function crear_servicio_alertas<Resultado extends PgQueryResultHKT>(db: PgDatabase<Resultado, typeof esquema>) {
  async function actualizar(actor: UsuarioSesion, input: unknown) {
    validar_rol(actor, ["superadmin", "admin"]);
    const datos = entrada_alerta.parse(input);
    const ignorada_hasta = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const resultado = await db.execute(sql`
      insert into estado_alertas_stock (producto_id, bodega_id, ignorada_hasta)
      select p.id, b.id, ${ignorada_hasta}::timestamptz
      from productos p join bodegas b on b.id = ${datos.bodega_id}
      where p.id = ${datos.producto_id}
        and coalesce((
          select sum(m.cantidad) from movimientos m
          where m.producto_id = p.id and m.bodega_id = b.id and m.fecha <= current_date
        ), 0) < p.stock_minimo
      on conflict (producto_id, bodega_id) do update
        set ignorada_hasta = excluded.ignorada_hasta
      returning producto_id
    `);
    if (!filas_resultado(resultado).length) throw new ErrorAcceso(404, "La alerta ya no está activa.");
  }
  return { actualizar };
}
