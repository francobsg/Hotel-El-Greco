import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { drizzle as drizzle_postgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { setTimeout as esperar } from "node:timers/promises";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";

import * as esquema from "@/db/schema";
import { crear_servicio_stats } from "@/lib/stats";
import { crear_servicio_alertas } from "@/lib/stats/alertas";
import { crear_servicio_stock } from "@/lib/stock/servicio";
import { type FiltrosPanel, leer_filtros } from "@/lib/stats/tipos";

const cliente = new PGlite();
const db = drizzle(cliente, { schema: esquema });
const stats = crear_servicio_stats(db);
const stock = crear_servicio_stock(db);
const filtros: FiltrosPanel = { fecha: "2026-10-14", dias: 7, bodega: null };
let producto_id: number;
let usuario_id: number;
let categoria_id: number;

beforeAll(async () => { await migrate(db, { migrationsFolder: "./db/migrations" }); });
afterAll(async () => { await cliente.close(); });
beforeEach(async () => {
  await cliente.exec("TRUNCATE usuarios, bodegas, categorias, productos, platillos, guias RESTART IDENTITY CASCADE; ALTER SEQUENCE folios_bodega_1 RESTART; ALTER SEQUENCE folios_bodega_2 RESTART;");
  const [usuario] = await db.insert(esquema.usuarios).values({ nombre: "Prueba", email: "prueba@test.cl", password_hash: "hash", rol: "superadmin" }).returning();
  usuario_id = usuario.id;
  await db.insert(esquema.bodegas).values([{ id: 1, nombre: "Principal" }, { id: 2, nombre: "Cocina" }]);
  const [categoria] = await db.insert(esquema.categorias).values({ nombre: "Vacuno", grupo_grafico: "Carnes" }).returning();
  categoria_id = categoria.id;
  const [producto] = await db.insert(esquema.productos).values({ nombre: "Vacuno", categoria_id, unidad: "kg", stock_critico: "1", stock_minimo: "5", stock_maximo: "100" }).returning();
  producto_id = producto.id;
});
async function ajuste(fecha: string, cantidad: string, positivo = true, bodega = 2) {
  return stock.registrarGuia({ tipo: positivo ? "ajuste_positivo" : "ajuste_negativo", ...(positivo ? { bodega_destino_id: bodega } : { bodega_origen_id: bodega }), fecha, usuario_id, items: [{ producto_id, cantidad }] });
}

it("historico: incluye saldo inicial, dias sin movimientos y excluye futuro/B1", async () => {
  await ajuste("2026-10-01", "10");
  await ajuste("2026-10-10", "2", false);
  await ajuste("2026-10-14", "0.125");
  await ajuste("2026-10-15", "50");
  await ajuste("2026-10-09", "100", true, 1);
  const graficos = await stats.stock_historico(filtros);
  expect(graficos).toHaveLength(4);
  const carnes = graficos.find((grafico) => grafico.grupo === "Carnes")!;
  const clave = carnes.series[0].clave;
  expect(carnes.datos).toHaveLength(7);
  expect(carnes.datos.map((dia) => dia[clave])).toEqual([10, 10, 8, 8, 8, 8, 8.125]);
  expect(carnes.datos[0].fecha).toBe("2026-10-08");
  expect(carnes.datos.at(-1)?.fecha).toBe("2026-10-14");
  expect(graficos.find((grafico) => grafico.grupo === "Pastas y arroz")?.series).toEqual([]);
});

it("periodos 7/30/90: conservan el mismo saldo al cierre", async () => {
  await ajuste("2026-06-01", "10");
  await ajuste("2026-10-14", "1.250", false);
  for (const dias of [7, 30, 90] as const) {
    const [grafico] = await stats.stock_historico({ ...filtros, dias });
    expect(grafico.datos).toHaveLength(dias);
    expect(grafico.datos.at(-1)?.[grafico.series[0].clave]).toBe(8.75);
  }
});

it("agrupa por grupo editable y mantiene kg/lt separados", async () => {
  const [liquido] = await db.insert(esquema.productos).values({ nombre: "Liquido", categoria_id, unidad: "lt" }).returning();
  await ajuste("2026-10-14", "2");
  await stock.registrarGuia({ tipo: "ajuste_positivo", bodega_destino_id: 2, fecha: filtros.fecha, usuario_id, items: [{ producto_id: liquido.id, cantidad: "3" }] });
  await db.update(esquema.categorias).set({ grupo_grafico: "Lácteos y huevos" }).where(eq(esquema.categorias.id, categoria_id));
  const graficos = await stats.stock_historico(filtros);
  expect(graficos[0].series).toEqual([]);
  const lacteos = graficos.find((grafico) => grafico.grupo === "Lácteos y huevos")!;
  expect(lacteos.series.map((serie) => serie.unidad).sort()).toEqual(["kg", "lt"]);
  for (const serie of lacteos.series) expect(lacteos.datos.at(-1)?.[serie.clave]).toBe(serie.unidad === "kg" ? 2 : 3);
});

it("KPI cuenta productos distintos; alertas incluyen stock cero y distinguen umbrales", async () => {
  let resumen = await stats.resumen_panel(filtros);
  expect(resumen.kpis).toEqual({ productos: 1, usuarios: 1, alertas: 1, movimientos: 0 });
  expect(resumen.total_alertas).toBe(2);
  expect(resumen.alertas.map((alerta) => alerta.estado)).toEqual(["critico", "critico"]);
  await ajuste("2026-10-14", "1", true, 1);
  await ajuste("2026-10-14", "5");
  resumen = await stats.resumen_panel(filtros);
  expect(resumen.total_alertas).toBe(1);
  expect(resumen.alertas[0]).toMatchObject({ bodega_id: 1, estado: "bajo", cantidad: "1.000" });
  expect((await stats.resumen_panel({ ...filtros, bodega: 2 })).kpis.alertas).toBe(0);
});

it("pagina las alertas de stock en grupos de cinco y limita la ultima pagina", async () => {
  await db.insert(esquema.productos).values(Array.from({ length: 5 }, (_, indice) => ({
    nombre: `Producto bajo ${indice + 1}`,
    categoria_id,
    unidad: "kg" as const,
    stock_critico: "1",
    stock_minimo: "5",
    stock_maximo: "100",
  })));
  const paginas = await Promise.all([1, 2, 3].map((pagina) => stats.resumen_panel(filtros, pagina)));
  expect(paginas.map((pagina) => pagina.alertas.length)).toEqual([5, 5, 2]);
  expect(paginas.map((pagina) => pagina.pagina_alertas)).toEqual([1, 2, 3]);
  expect(paginas.map((pagina) => pagina.paginas_alertas)).toEqual([3, 3, 3]);
  expect(paginas.every((pagina) => pagina.total_alertas === 12)).toBe(true);
  expect(new Set(paginas.flatMap((pagina) => pagina.alertas.map((alerta) => `${alerta.producto_id}_${alerta.bodega_id}`))).size).toBe(12);
  expect(await stats.resumen_panel(filtros, 99)).toMatchObject({ pagina_alertas: 3, alertas: paginas[2].alertas });
  await expect(stats.resumen_panel(filtros, 0)).rejects.toThrow("entero positivo");
});

it("movimientos: devuelve los cinco mas recientes por fecha/id y respeta bodega/corte", async () => {
  for (let dia = 1; dia <= 7; dia++) await ajuste(`2026-10-0${dia}`, "1");
  await ajuste("2026-10-15", "1");
  await ajuste("2026-10-14", "2", true, 1);
  const resumen = await stats.resumen_panel(filtros);
  expect(resumen.movimientos).toHaveLength(5);
  expect(resumen.movimientos[0]).toMatchObject({ fecha: "2026-10-14", bodega: "Principal" });
  expect(resumen.kpis.movimientos).toBe(1);
  const cocina = await stats.resumen_panel({ ...filtros, bodega: 2 });
  expect(cocina.movimientos.map((movimiento) => movimiento.fecha)).toEqual(["2026-10-07", "2026-10-06", "2026-10-05", "2026-10-04", "2026-10-03"]);
  expect(cocina.kpis.movimientos).toBe(0);
});

it("base vacia: ceros y estados vacios; valida parametros", async () => {
  await cliente.exec("TRUNCATE usuarios, bodegas, categorias, productos RESTART IDENTITY CASCADE;");
  expect(await stats.resumen_panel(filtros)).toMatchObject({ kpis: { productos: 0, usuarios: 0, alertas: 0, movimientos: 0 }, movimientos: [], alertas: [] });
  expect((await stats.stock_historico(filtros)).every((grafico) => grafico.datos.length === 0)).toBe(true);
  await expect(stats.stock_historico({ ...filtros, dias: 365 as 7 })).rejects.toThrow();
  expect(leer_filtros({ dias: "365", bodega: "999" }).aviso).not.toBeNull();
  // Los nuevos indices corresponden a los patrones reales de consulta.
  const indices = await db.execute(sql`select indexname from pg_indexes where tablename = 'movimientos'`);
  expect(indices.rows.map((indice) => indice.indexname)).toContain("movimientos_bodega_fecha_idx");
});

it("ignora una alerta por siete dias y permite la accion limitada al administrador", async () => {
  await ajuste("2026-10-14", "10", true, 1);
  await ajuste("2026-10-14", "2");
  const actor = { id: usuario_id, nombre: "Prueba", email: "prueba@test.cl", rol: "superadmin" as const, version_sesion: 0, movil: false };
  const servicio = crear_servicio_alertas(db);
  const alerta = { producto_id, bodega_id: 2 };

  expect((await stats.resumen_panel(filtros)).alertas.some((fila) => fila.producto_id === producto_id && fila.bodega_id === 2)).toBe(true);
  await servicio.actualizar(actor, { ...alerta, accion: "ignorar" });
  expect((await stats.resumen_panel(filtros)).alertas.some((fila) => fila.producto_id === producto_id && fila.bodega_id === 2)).toBe(false);

  await db.update(esquema.estado_alertas_stock).set({ ignorada_hasta: new Date(Date.now() - 1000) });
  expect((await stats.resumen_panel(filtros)).alertas.some((fila) => fila.producto_id === producto_id && fila.bodega_id === 2)).toBe(true);
  const admin = { ...actor, id: usuario_id, rol: "admin" as const };
  await servicio.actualizar(admin, { ...alerta, accion: "ignorar" });
  expect((await stats.resumen_panel(filtros)).alertas.some((fila) => fila.producto_id === producto_id && fila.bodega_id === 2)).toBe(false);
});

it("driver postgres: ejecuta resumen e historico con los resultados reales del protocolo", async () => {
  await ajuste("2026-10-14", "2");
  const socket = new PGLiteSocketServer({ db: cliente, host: "127.0.0.1", port: 0, maxConnections: 20 });
  await socket.start();
  const conexion = postgres(`postgresql://postgres:prueba@${socket.getServerConn()}/postgres`, { prepare: false, max: 1 });
  try {
    const servicio = crear_servicio_stats(drizzle_postgres(conexion, { schema: esquema }));
    const [resumen, graficos] = await Promise.all([servicio.resumen_panel(filtros), servicio.stock_historico(filtros)]);
    expect(resumen.kpis.productos).toBe(1);
    expect(graficos[0].datos.at(-1)?.[graficos[0].series[0].clave]).toBe(2);
    const actor = { id: usuario_id, nombre: "Prueba", email: "prueba@test.cl", rol: "superadmin" as const, version_sesion: 0, movil: false };
    await crear_servicio_alertas(drizzle_postgres(conexion, { schema: esquema })).actualizar(actor, { producto_id, bodega_id: 2, accion: "ignorar" });
    expect((await servicio.resumen_panel(filtros)).alertas.some((fila) => fila.producto_id === producto_id && fila.bodega_id === 2)).toBe(false);
  } finally {
    await conexion.end();
    await socket.stop();
    await esperar(20);
  }
});
