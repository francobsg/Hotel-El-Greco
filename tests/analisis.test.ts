import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, beforeEach, afterAll, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import * as e from "@/db/schema";
import { crear_servicio_stock } from "@/lib/stock/servicio";
import { crear_servicio_analisis } from "@/lib/analisis/servicio";
import { crear_excel_mensual } from "@/lib/analisis/excel";
import { crear_servicio_configuracion } from "@/lib/configuracion/servicio";
import { crear_servicio_caja } from "@/lib/caja/servicio";
import { limites_mes } from "@/lib/analisis/tipos";
import { fecha_chile } from "@/lib/stats/tipos";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { UsuarioSesion } from "@/lib/auth/permisos";
const cliente = new PGlite(), db = drizzle(cliente, { schema: e });
const stock = crear_servicio_stock(db), analisis = crear_servicio_analisis(db), configuracion = crear_servicio_configuracion(db);
const actor: UsuarioSesion = { id: 1, nombre: "Super", email: "super@test.cl", rol: "superadmin", version_sesion: 0, movil: false };
const periodo = { mes: 10, ano: 2026, bodega: 1 };
beforeAll(async () => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-14T15:00:00Z")); await migrate(db, { migrationsFolder: "./db/migrations" }); });
afterAll(async () => { await cliente.close(); vi.useRealTimers(); });
beforeEach(async () => {
  await cliente.exec("TRUNCATE usuarios, bodegas, categorias, productos, platillos, guias RESTART IDENTITY CASCADE;");
  await db.insert(e.usuarios).values([{ nombre: "Super", email: actor.email, password_hash: "prueba", rol: "superadmin" }, { nombre: "Admin", email: "admin@test.cl", password_hash: "prueba", rol: "admin" }, { nombre: "Trabajador", email: "worker@test.cl", password_hash: "prueba", rol: "trabajador" }]);
  await db.insert(e.bodegas).values([{ id: 1, nombre: "Principal" }, { id: 2, nombre: "Cocina" }]);
  await db.insert(e.categorias).values({ nombre: "Carnes", grupo_grafico: "Carnes" });
  await db.insert(e.productos).values([{ nombre: "Pollo", categoria_id: 1, unidad: "kg", stock_critico: "0.1", stock_minimo: "0.5", stock_maximo: "5" }, { nombre: "Leche", categoria_id: 1, unidad: "lt" }]);
  await db.insert(e.platillos).values({ nombre: "Plato", activo: true });
  await db.insert(e.recetas).values({ platillo_id: 1, producto_id: 1, gramos_o_ml: "100" });
  await stock.registrarGuia({ tipo: "entrada", bodega_destino_id: 1, fecha: "2026-09-30", n_factura: "Septiembre", usuario_id: 1, items: [{ producto_id: 1, cantidad: "10" }] });
  await stock.registrarGuia({ tipo: "traspaso", bodega_origen_id: 1, bodega_destino_id: 2, fecha: "2026-09-30", usuario_id: 1, items: [{ producto_id: 1, cantidad: "2" }] });
  await stock.registrarGuia({ tipo: "entrada", bodega_destino_id: 1, fecha: "2026-10-01", n_factura: "Octubre", usuario_id: 1, items: [{ producto_id: 1, cantidad: "5" }, { producto_id: 1, cantidad: "1", marca: "Marca A" }, { producto_id: 1, cantidad: "2", marca: "Marca B" }] });
  await stock.registrarGuia({ tipo: "traspaso", bodega_origen_id: 1, bodega_destino_id: 2, fecha: "2026-10-01", usuario_id: 1, items: [{ producto_id: 1, cantidad: "1" }] });
  await stock.registrarGuia({ tipo: "consumo", bodega_origen_id: 2, fecha: "2026-10-07", usuario_id: 1, items: [{ producto_id: 1, cantidad: "0.6" }] });
  await stock.registrarGuia({ tipo: "venta", bodega_origen_id: 2, fecha: "2026-10-10", usuario_id: 1, items: [{ producto_id: 1, cantidad: "0.3" }] });
});
it("cierre mensual incluye saldo previo y signos separados por bodega, sin duplicar productos repetidos", async () => {
  expect((await analisis.resumen_mes(periodo))[1]).toMatchObject({ producto: "Pollo", inicial: "8.000", entradas: "8.000", salidas: "1.000", final: "15.000" });
  expect((await analisis.resumen_mes({ ...periodo, bodega: 2 }))[1]).toMatchObject({ inicial: "2.000", entradas: "1.000", salidas: "0.900", final: "2.100" });
  const movimientos = await analisis.movimientos_mes(periodo); expect(movimientos).toHaveLength(4);
  expect(movimientos.map((m) => m.marca)).toEqual([null, "Marca A", "Marca B", null]);
  expect(await analisis.movimientos_mes(periodo, movimientos[movimientos.length - 1].id)).toHaveLength(0);
  expect(limites_mes(2024, 2)).toEqual({ inicio: "2024-02-01", fin: "2024-03-01" });
});
it("Excel tiene ambas hojas, encabezado verde, filtros y valores numericos", async () => {
  async function* lotes() { yield await analisis.movimientos_mes(periodo); }
  const contenido = await crear_excel_mensual(1, "2026-10", lotes(), await analisis.resumen_mes(periodo));
  const libro = new ExcelJS.Workbook(); await libro.xlsx.load(contenido);
  const h = libro.getWorksheet("Movimientos")!, r = libro.getWorksheet("Resumen")!;
  expect(h.rowCount).toBe(5); expect(r.rowCount).toBe(3); expect(h.autoFilter).toBeTruthy();
  expect(h.getCell("E2").value).toBe(5); expect(r.getCell("F3").value).toBe(15);
  expect(h.getCell("A1").fill).toMatchObject({ fgColor: { argb: "FF14532D" } });
});
it("estadisticas excluye traspasos del consumo, distingue unidad y conserva entradas semanales", async () => {
  const datos = await analisis.estadisticas({ inicio: "2026-10-01", fin: "2026-10-14", bodega: 2, unidad: "kg" });
  expect(datos.categorias).toEqual([{ nombre: "Carnes", cantidad: 0.9 }]);
  expect(datos.usados[0]).toMatchObject({ dias: 2, cantidad: 0.9 });
  expect(datos.semanas.reduce((s, d) => s + d.entradas, 0)).toBe(1);
  expect(datos.rotacion[0].promedio).toBe(2.05);
  expect((await analisis.estadisticas({ inicio: "2026-10-01", fin: "2026-10-14", bodega: 2, unidad: "lt" })).categorias).toHaveLength(0);
});
it("promedio movil divide por 30 dias y no inventa dias restantes sin consumo", async () => {
  const p = await analisis.prediccion({ bodega: 2, pagina: 1, buscar: "Pollo" });
  expect(p.filas[0]).toMatchObject({ stock: 2.1, promedio: 0.03, dias: 70, reponer: 0 });
  expect((await analisis.prediccion({ bodega: 2, pagina: 1, buscar: "Leche" })).filas[0].dias).toBeNull();
  await stock.registrarGuia({ tipo: "consumo", bodega_origen_id: 2, fecha: fecha_chile(), usuario_id: 1, items: [{ producto_id: 1, cantidad: "1.8" }] });
  expect((await analisis.prediccion({ bodega: 2, pagina: 1, buscar: "Pollo" })).filas[0]).toMatchObject({ stock: 0.3, promedio: 0.09, reponer: 0.96 });
});
it("configuracion CRUD protege permisos, referencias, unidades y stock real", async () => {
  for (const rol of ["admin", "trabajador"] as const) await expect(configuracion.modificar({ ...actor, rol }, "categorias", { nombre: "Nueva", grupo_grafico: null })).rejects.toMatchObject({ estado: 403 });
  await expect(configuracion.modificar(actor, "niveles", { stock_critico: "3", stock_minimo: "2", stock_maximo: "5" }, 1)).rejects.toThrow();
  await configuracion.modificar(actor, "niveles", { stock_critico: "1", stock_minimo: "2", stock_maximo: "5" }, 1);
  expect(await stock.getStock(1, 2)).toBe("2.100");
  await expect(configuracion.modificar(actor, "categorias", null, 1, true)).rejects.toMatchObject({ estado: 409 });
  const nueva = await configuracion.modificar(actor, "categorias", { nombre: "Nueva", grupo_grafico: null });
  await configuracion.modificar(actor, "categorias", { nombre: "Editada", grupo_grafico: "Carnes" }, nueva.id);
  await configuracion.modificar(actor, "categorias", null, nueva.id, true);
  await db.update(e.usuarios).set({ rol: "admin" }).where(eq(e.usuarios.id, actor.id));
  await expect(configuracion.modificar(actor, "platillos", { nombre: "Nuevo", precio: null, activo: true })).rejects.toMatchObject({ estado: 403 });
});
it("platillos con ventas no se eliminan; recetas invalidas o duplicadas se rechazan", async () => {
  await crear_servicio_caja(db).registrar_venta(actor, { clave: randomUUID(), confirmada: true, items: [{ platillo_id: 1, cantidad: 1 }] });
  await expect(configuracion.modificar(actor, "platillos", null, 1, true)).rejects.toMatchObject({ estado: 409 });
  await expect(configuracion.modificar(actor, "recetas", { platillo_id: 1, producto_id: 1, gramos_o_ml: "120" })).rejects.toMatchObject({ estado: 409 });
  await expect(configuracion.modificar(actor, "recetas", { platillo_id: 1, producto_id: 2, gramos_o_ml: "0.5" })).rejects.toThrow();
  await configuracion.modificar(actor, "recetas", { platillo_id: 1, producto_id: 2, gramos_o_ml: "20" });
  expect((await configuracion.listar("recetas")).total).toBe(2);
});
