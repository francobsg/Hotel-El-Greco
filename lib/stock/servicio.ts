import { and, eq, inArray, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";

import * as esquema from "@/db/schema";
import type { Rol } from "@/lib/auth/permisos";
import { ErrorAcceso } from "@/lib/auth/servicio";

const id_valido = z.number().int().positive().max(2147483647);
const cantidad_valida = z.union([z.string(), z.number().finite()])
  .transform(String)
  .pipe(z.string().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/, "Usa una cantidad con hasta 3 decimales."))
  .refine((valor) => a_milesimas(valor) > BigInt(0), "La cantidad debe ser positiva.")
  .transform((valor) => desde_milesimas(a_milesimas(valor)));

export const entrada_guia = z.object({
  tipo: z.enum(esquema.tipo_guia.enumValues),
  bodega_origen_id: id_valido.nullish(),
  bodega_destino_id: id_valido.nullish(),
  n_factura: z.string().trim().min(1).max(100).nullish(),
  fecha: z.iso.date(),
  glosa: z.string().trim().max(2000).nullish(),
  usuario_id: id_valido,
  imagen_factura_url: z.url().max(2048).nullish(),
  items: z.array(z.object({
    producto_id: id_valido,
    cantidad: cantidad_valida,
    marca: z.string().trim().max(100).nullish(),
    descripcion: z.string().trim().max(2000).nullish(),
  }).strict()).min(1).max(200),
}).strict().superRefine((guia, contexto) => {
  const { tipo, bodega_origen_id: origen, bodega_destino_id: destino } = guia;
  const es_entrada = tipo === "entrada" || tipo === "ajuste_positivo";
  const valido = tipo === "traspaso" ? origen === 1 && destino === 2
    : es_entrada ? !origen && !!destino : !!origen && !destino;
  if (!valido) contexto.addIssue({ code: "custom", message: "Bodegas invalidas para el tipo de guia.", path: ["tipo"] });
  if (tipo === "entrada" && (destino !== 1 || !guia.n_factura)) {
    contexto.addIssue({ code: "custom", message: "La entrada debe llegar a Bodega 1 con numero de factura.", path: ["n_factura"] });
  }
  if ((tipo === "consumo" || tipo === "venta") && origen !== 2) {
    contexto.addIssue({ code: "custom", message: "El consumo y la venta corresponden a Bodega 2.", path: ["bodega_origen_id"] });
  }
});

export type EntradaGuia = z.input<typeof entrada_guia>;

// Enteros escalados para sumar sin errores de coma flotante.
function a_milesimas(valor: string): bigint {
  const [entero, decimal = ""] = valor.split(".");
  const signo = entero.startsWith("-") ? BigInt(-1) : BigInt(1);
  return signo * (BigInt(entero.replace("-", "")) * BigInt(1000) + BigInt(decimal.padEnd(3, "0")));
}

function desde_milesimas(valor: bigint): string {
  const absoluto = valor < BigInt(0) ? -valor : valor;
  return `${valor < BigInt(0) ? "-" : ""}${absoluto / BigInt(1000)}.${String(absoluto % BigInt(1000)).padStart(3, "0")}`;
}

export function convertir_receta_a_unidad(gramos_o_ml: string | number, unidad: typeof esquema.unidad_producto.enumValues[number]): string {
  if (unidad !== "kg" && unidad !== "lt") {
    throw new Error("La receta requiere kg o lt; un y caja necesitan una equivalencia definida.");
  }
  const valor = a_milesimas(cantidad_valida.parse(gramos_o_ml));
  if (valor % BigInt(1000) !== BigInt(0)) throw new Error("La receta requiere una precision mayor a 0,001 kg/lt.");
  return desde_milesimas(valor / BigInt(1000));
}

export function crear_servicio_stock<Resultado extends PgQueryResultHKT>(db: PgDatabase<Resultado, typeof esquema>) {
  async function getStock(productoId: number, bodegaId: number): Promise<string> {
    const producto_id = id_valido.parse(productoId);
    const bodega_id = id_valido.parse(bodegaId);
    const [saldo] = await db.select({ cantidad: esquema.stock_actual.cantidad }).from(esquema.stock_actual)
      .where(and(eq(esquema.stock_actual.producto_id, producto_id), eq(esquema.stock_actual.bodega_id, bodega_id)));
    return saldo ? desde_milesimas(a_milesimas(saldo.cantidad)) : "0.000";
  }

  async function registrarGuia(input: EntradaGuia, permiso?: { roles: readonly Rol[]; version_sesion: number; factura_unica?: boolean }) {
    const guia = entrada_guia.parse(input);
    return db.transaction(async (tx) => {
      const [usuario] = await tx.select().from(esquema.usuarios).where(eq(esquema.usuarios.id, guia.usuario_id)).for("share");
      if (permiso && (!usuario?.activo || usuario.version_sesion !== permiso.version_sesion)) throw new ErrorAcceso(401, "Tu sesión ya no es válida.");
      if (permiso && usuario && !permiso.roles.includes(usuario.rol)) throw new ErrorAcceso(403, "No tienes permiso para registrar esta guía.");
      if (!usuario?.activo || usuario.rol === "admin") throw new Error("Usuario sin permiso para registrar guias.");
      if (guia.tipo.startsWith("ajuste_") && usuario.rol !== "superadmin") throw new Error("Solo superadmin puede registrar ajustes.");
      if (permiso?.factura_unica && guia.imagen_factura_url) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${guia.imagen_factura_url}, 0))`);
        const [existente] = await tx.select().from(esquema.guias).where(eq(esquema.guias.imagen_factura_url, guia.imagen_factura_url));
        if (existente) {
          if (existente.usuario_id !== guia.usuario_id || existente.tipo !== "entrada") throw new ErrorAcceso(409, "La factura ya está registrada.");
          return existente;
        }
      }

      const cantidades = new Map<number, bigint>();
      for (const item of guia.items) cantidades.set(item.producto_id, (cantidades.get(item.producto_id) ?? BigInt(0)) + a_milesimas(item.cantidad));
      const ids_productos = [...cantidades.keys()].sort((a, b) => a - b);
      const registros = await tx.select({ id: esquema.productos.id }).from(esquema.productos).where(inArray(esquema.productos.id, ids_productos));
      if (registros.length !== ids_productos.length) throw new Error("Uno o mas productos no existen.");

      const ids_bodegas = [guia.bodega_origen_id, guia.bodega_destino_id].filter((id): id is number => !!id).sort((a, b) => a - b);
      const bodegas = await tx.select({ id: esquema.bodegas.id }).from(esquema.bodegas).where(inArray(esquema.bodegas.id, ids_bodegas));
      if (bodegas.length !== ids_bodegas.length) throw new Error("Una o mas bodegas no existen.");
      // Orden global de bloqueos: evita carreras y deadlocks, incluso sin movimientos previos.
      for (const bodega_id of ids_bodegas) {
        await tx.execute(sql`select pg_advisory_xact_lock(${bodega_id}::integer, producto_id)
          from unnest(array[${sql.join(ids_productos.map((id) => sql`${id}`), sql`, `)}]::integer[]) as bloqueos(producto_id) order by producto_id`);
      }
      if (guia.bodega_origen_id) {
        const saldos = await tx.select({ producto_id: esquema.stock_actual.producto_id, cantidad: esquema.stock_actual.cantidad }).from(esquema.stock_actual)
          .where(and(eq(esquema.stock_actual.bodega_id, guia.bodega_origen_id), inArray(esquema.stock_actual.producto_id, ids_productos)));
        const disponibles = new Map(saldos.map((saldo) => [saldo.producto_id, a_milesimas(saldo.cantidad)]));
        for (const [producto_id, cantidad] of cantidades) {
          if ((disponibles.get(producto_id) ?? BigInt(0)) < cantidad) throw new Error(`Stock insuficiente para producto ${producto_id} en bodega ${guia.bodega_origen_id}.`);
        }
      }

      const { items, ...cabecera } = guia;
      const [registrada] = await tx.insert(esquema.guias).values(cabecera).returning();
      await tx.insert(esquema.guia_items).values(items.map((item) => ({ ...item, guia_id: registrada.id })));
      const movimientos: typeof esquema.movimientos.$inferInsert[] = [];
      // Una fila por item mantiene precision numeric(12,3) incluso con productos repetidos.
      for (const item of items) {
        const comun = { guia_id: registrada.id, producto_id: item.producto_id, fecha: guia.fecha };
        if (guia.bodega_origen_id) movimientos.push({ ...comun, bodega_id: guia.bodega_origen_id, cantidad: `-${item.cantidad}` });
        if (guia.bodega_destino_id) movimientos.push({ ...comun, bodega_id: guia.bodega_destino_id, cantidad: item.cantidad });
      }
      await tx.insert(esquema.movimientos).values(movimientos);
      return registrada;
    }, { isolationLevel: "read committed" });
  }

  return { getStock, registrarGuia };
}
