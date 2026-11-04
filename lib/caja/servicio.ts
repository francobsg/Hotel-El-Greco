import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as esquema from "@/db/schema";
import type { UsuarioSesion } from "@/lib/auth/permisos";
import { ErrorAcceso } from "@/lib/auth/servicio";
import { fecha_chile } from "@/lib/stats/tipos";
import { crear_servicio_stock } from "@/lib/stock/servicio";
import { agrupar_platillos, calcular_ingredientes } from "./calculos";
import { entrada_venta, type EntradaVenta, type DiaProvisional, type DatosCaja } from "./tipos";

export function crear_servicio_caja<R extends PgQueryResultHKT>(db: PgDatabase<R, typeof esquema>) {
  async function registrar_venta(actor: UsuarioSesion, input: EntradaVenta) {
    const venta = entrada_venta.parse(input);
    const items = agrupar_platillos(venta.items);
    return db.transaction(async (tx) => {
      const [usuario] = await tx.select().from(esquema.usuarios).where(eq(esquema.usuarios.id, actor.id)).for("share");
      if (!usuario?.activo || usuario.version_sesion !== actor.version_sesion) throw new ErrorAcceso(401, "Tu sesión ya no es válida.");
      if (usuario.rol === "admin") throw new ErrorAcceso(403, "Tu cuenta es de solo lectura.");
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${"caja:" + venta.clave}, 0))`);
      const [existente] = await tx.select().from(esquema.guias).where(eq(esquema.guias.clave_venta, venta.clave));
      if (existente) {
        const previos = await tx.select({ platillo_id: esquema.ventas_temporales.platillo_id, cantidad: esquema.ventas_temporales.cantidad }).from(esquema.ventas_temporales).where(eq(esquema.ventas_temporales.guia_id, existente.id));
        if (existente.usuario_id !== usuario.id || JSON.stringify(agrupar_platillos(previos)) !== JSON.stringify(items)) throw new ErrorAcceso(409, "Esta confirmación ya corresponde a otra venta.");
        return { guia_id: existente.id, folio: existente.folio, total_platos: items.reduce((n, i) => n + i.cantidad, 0), provisional: true };
      }
      const ids = items.map((item) => item.platillo_id);
      const platos = await tx.select().from(esquema.platillos).where(and(inArray(esquema.platillos.id, ids), eq(esquema.platillos.activo, true))).for("share");
      if (platos.length !== ids.length) throw new ErrorAcceso(422, "Hay un platillo inexistente o inactivo. Actualiza el menú.");
      const recetas = await tx.select({ platillo_id: esquema.recetas.platillo_id, producto_id: esquema.recetas.producto_id, gramos_o_ml: esquema.recetas.gramos_o_ml, unidad: esquema.productos.unidad, nombre: esquema.productos.nombre }).from(esquema.recetas).innerJoin(esquema.productos, eq(esquema.productos.id, esquema.recetas.producto_id)).where(inArray(esquema.recetas.platillo_id, ids)).for("share");
      const ingredientes = calcular_ingredientes(items, recetas);
      const fecha = fecha_chile();
      let guia;
      try {
        guia = await crear_servicio_stock(tx).registrarGuia({ tipo: "venta", bodega_origen_id: 2, usuario_id: usuario.id, fecha, glosa: "Venta provisional de caja", items: ingredientes }, { roles: ["superadmin", "trabajador"], version_sesion: actor.version_sesion });
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("Stock insuficiente")) throw new ErrorAcceso(409, "Stock insuficiente en Bodega 2. Revisa los ingredientes disponibles; la venta no se registró.");
        throw error;
      }
      await tx.update(esquema.guias).set({ provisional: true, clave_venta: venta.clave }).where(eq(esquema.guias.id, guia.id));
      await tx.insert(esquema.ventas_temporales).values(items.map((item) => ({ ...item, guia_id: guia.id, usuario_id: usuario.id, fecha })));
      return { guia_id: guia.id, folio: guia.folio, total_platos: items.reduce((n, i) => n + i.cantidad, 0), provisional: true };
    });
  }

  async function datos(): Promise<DatosCaja> {
    const fecha = fecha_chile();
    const platos = await db.select().from(esquema.platillos).where(eq(esquema.platillos.activo, true)).orderBy(esquema.platillos.nombre);
    const recetas = await db.select({ platillo_id: esquema.recetas.platillo_id, producto_id: esquema.recetas.producto_id, gramos_o_ml: esquema.recetas.gramos_o_ml, unidad: esquema.productos.unidad, nombre: esquema.productos.nombre }).from(esquema.recetas).innerJoin(esquema.productos, eq(esquema.productos.id, esquema.recetas.producto_id));
    const existencias = await db.select().from(esquema.stock_actual).where(eq(esquema.stock_actual.bodega_id, 2));
    const stock = new Map(existencias.map((fila) => [fila.producto_id, Number(fila.cantidad)]));
    const menu = platos.map((platillo) => {
      try {
        const ingredientes = calcular_ingredientes([{ platillo_id: platillo.id, cantidad: 1 }], recetas);
        const disponible = Math.min(999, ...ingredientes.map((i) => Math.max(0, Math.floor(((stock.get(i.producto_id) ?? 0) + 1e-9) / Number(i.cantidad)))));
        return { id: platillo.id, nombre: platillo.nombre, precio: platillo.precio, disponible, error_receta: null };
      } catch (error) {
        return { id: platillo.id, nombre: platillo.nombre, precio: platillo.precio, disponible: 0, error_receta: error instanceof Error ? error.message : "Receta no disponible." };
      }
    });
    const totales = await db.select({ platillo_id: esquema.platillos.id, nombre: esquema.platillos.nombre, cantidad: sql<number>`sum(${esquema.ventas_temporales.cantidad})::integer` }).from(esquema.ventas_temporales).innerJoin(esquema.platillos, eq(esquema.platillos.id, esquema.ventas_temporales.platillo_id)).where(eq(esquema.ventas_temporales.fecha, fecha)).groupBy(esquema.platillos.id).orderBy(esquema.platillos.nombre);
    // Subconsulta de guias evita multiplicar ingredientes al tener varios platillos en una venta.
    const guias_dia = db.selectDistinct({ id: esquema.ventas_temporales.guia_id }).from(esquema.ventas_temporales).where(eq(esquema.ventas_temporales.fecha, fecha));
    const ingredientes = await db.select({ producto_id: esquema.productos.id, nombre: esquema.productos.nombre, unidad: esquema.productos.unidad, cantidad: sql<string>`sum(${esquema.guia_items.cantidad})::text` }).from(esquema.guia_items).innerJoin(esquema.productos, eq(esquema.productos.id, esquema.guia_items.producto_id)).where(inArray(esquema.guia_items.guia_id, guias_dia)).groupBy(esquema.productos.id).orderBy(esquema.productos.nombre);
    const filas = await db.select({ id: esquema.ventas_temporales.id, nombre: esquema.platillos.nombre, cantidad: esquema.ventas_temporales.cantidad, hora: esquema.ventas_temporales.hora, usuario: esquema.usuarios.nombre, folio: esquema.guias.folio }).from(esquema.ventas_temporales).innerJoin(esquema.platillos, eq(esquema.platillos.id, esquema.ventas_temporales.platillo_id)).innerJoin(esquema.usuarios, eq(esquema.usuarios.id, esquema.ventas_temporales.usuario_id)).innerJoin(esquema.guias, eq(esquema.guias.id, esquema.ventas_temporales.guia_id)).where(eq(esquema.ventas_temporales.fecha, fecha)).orderBy(desc(esquema.ventas_temporales.hora), desc(esquema.ventas_temporales.id)).limit(20);
    const productos = await db.select().from(esquema.productos);
    const alertas: DatosCaja["resumen"]["alertas"] = productos.filter((p) => (stock.get(p.id) ?? 0) < Number(p.stock_minimo)).map((p) => ({ producto_id: p.id, nombre: p.nombre, unidad: p.unidad, cantidad: String(stock.get(p.id) ?? 0), estado: (stock.get(p.id) ?? 0) < Number(p.stock_critico) ? "critico" : "bajo" }));
    return { menu, resumen: { fecha, platos: totales, ingredientes, registros: filas.map((fila) => ({ ...fila, hora: fila.hora.toISOString() })), alertas } };
  }
  async function dias(): Promise<DiaProvisional[]> {
    const filas = await db.select({ fecha: esquema.ventas_temporales.fecha, total: sql<number>`sum(${esquema.ventas_temporales.cantidad})::integer` }).from(esquema.ventas_temporales).groupBy(esquema.ventas_temporales.fecha).orderBy(desc(esquema.ventas_temporales.fecha));
    const hoy = fecha_chile();
    return filas.some((fila) => fila.fecha === hoy) ? filas : [{ fecha: hoy, total: 0 }, ...filas];
  }
  return { registrar_venta, datos, dias };
}
