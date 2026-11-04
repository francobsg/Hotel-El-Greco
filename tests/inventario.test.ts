import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import ExcelJS from "exceljs";
import * as esquema from "@/db/schema";
import { crear_servicio_inventario } from "@/lib/inventario/servicio";
import { crear_servicio_stock } from "@/lib/stock/servicio";
import { exportar_inventario } from "@/lib/inventario/excel";
import { estado_stock, leer_filtros_inventario, type FiltrosInventario } from "@/lib/inventario/tipos";
import type { UsuarioSesion } from "@/lib/auth/permisos";

const cliente = new PGlite();
const db = drizzle(cliente, { schema: esquema });
const inventario = crear_servicio_inventario(db);
const stock = crear_servicio_stock(db);
const filtros: FiltrosInventario = { fecha: "2026-10-14", bodega: null, buscar: "", pagina: 1, registros: 10, alertas: false };
const nuevo = { nombre: "Producto nuevo", categoria_id: 1, unidad: "kg", marca: "", stock_critico: "1", stock_minimo: "2", stock_maximo: "100", costo: "2500.50" };
let actor: UsuarioSesion;
beforeAll(async () => { await migrate(db, { migrationsFolder: "./db/migrations" }); });
afterAll(async () => { await cliente.close(); });
beforeEach(async () => {
  await cliente.exec("TRUNCATE usuarios, bodegas, categorias, productos, platillos, guias RESTART IDENTITY CASCADE; ALTER SEQUENCE folios_bodega_1 RESTART; ALTER SEQUENCE folios_bodega_2 RESTART;");
  const [usuario] = await db.insert(esquema.usuarios).values({ nombre: "Prueba", email: "prueba@test.cl", password_hash: "hash", rol: "superadmin" }).returning();
  actor = { ...usuario, movil: false };
  await db.insert(esquema.bodegas).values([{ id: 1, nombre: "Principal" }, { id: 2, nombre: "Cocina" }]);
  await db.insert(esquema.categorias).values({ nombre: "Carnes" });
});

it("pagina en SQL, orden estable, clamps pagina, y mantiene productos sin movimientos", async () => {
  await db.insert(esquema.productos).values(Array.from({ length: 23 }, (_, indice) => ({ nombre: `Producto ${String(indice).padStart(2, "0")}`, categoria_id: 1, unidad: "kg" as const })));
  const pagina = await inventario.listar({ ...filtros, pagina: 2 });
  expect(pagina).toMatchObject({ total: 23, pagina: 2, paginas: 3 });
  expect(pagina.filas).toHaveLength(10);
  expect(pagina.filas[0]).toMatchObject({ nombre: "Producto 10", stock_1: "0", stock_2: "0" });
  const ultima = await inventario.listar({ ...filtros, pagina: 2147483647 });
  expect(ultima.pagina).toBe(3); expect(ultima.filas).toHaveLength(3);
  expect((await inventario.listar(filtros, true)).filas).toHaveLength(23);
});
it("saldos, alertas y detalle respetan bodega y fecha incluyendo cero", async () => {
  const producto = await inventario.guardar(actor, nuevo);
  await stock.registrarGuia({ tipo: "entrada", bodega_destino_id: 1, n_factura: "10", usuario_id: actor.id, fecha: "2026-10-13", items: [{ producto_id: producto.id, cantidad: "10.125" }] });
  await stock.registrarGuia({ tipo: "traspaso", bodega_origen_id: 1, bodega_destino_id: 2, usuario_id: actor.id, fecha: "2026-10-14", items: [{ producto_id: producto.id, cantidad: "2" }] });
  expect((await inventario.listar(filtros)).filas[0]).toMatchObject({ stock_1: "8.125", stock_2: "2.000" });
  expect((await inventario.listar({ ...filtros, alertas: true })).total).toBe(0);
  expect((await inventario.listar({ ...filtros, alertas: true, fecha: "2026-10-13", bodega: 2 })).total).toBe(1);
  expect((await inventario.listar({ ...filtros, alertas: true, fecha: "2026-10-13", bodega: 1 })).total).toBe(0);
  const detalle = await inventario.detalle(producto.id, filtros);
  expect(detalle.movimientos.map((fila) => fila.cantidad)).toEqual(["2.000", "-2.000", "10.125"]);
  expect((await inventario.detalle(producto.id, { ...filtros, fecha: "2026-10-13" })).movimientos).toHaveLength(1);
  expect(estado_stock("1", detalle.producto)).toBe("bajo"); expect(estado_stock("2", detalle.producto)).toBe("normal"); expect(estado_stock("0", detalle.producto)).toBe("critico");
  await expect(inventario.detalle(999, filtros)).rejects.toMatchObject({ estado: 404 });
});
it("busca nombre, categoria y marca; comodines se tratan como texto literal", async () => {
  await inventario.guardar(actor, { ...nuevo, nombre: "Leche 100%", marca: "Marca real" });
  await inventario.guardar(actor, { ...nuevo, nombre: "Otra leche" });
  expect((await inventario.listar({ ...filtros, buscar: "LECHE" })).total).toBe(2);
  expect((await inventario.listar({ ...filtros, buscar: "Carnes" })).total).toBe(2);
  expect((await inventario.listar({ ...filtros, buscar: "real" })).total).toBe(1);
  expect((await inventario.listar({ ...filtros, buscar: "%" })).total).toBe(1);
  expect((await inventario.listar({ ...filtros, buscar: "_" })).total).toBe(0);
});
it("alta exige superadmin vigente, categoria valida y niveles ordenados; nunca crea movimientos", async () => {
  await expect(inventario.guardar({ ...actor, rol: "admin" }, nuevo)).rejects.toMatchObject({ estado: 403 });
  await expect(inventario.guardar({ ...actor, rol: "trabajador" }, nuevo)).rejects.toMatchObject({ estado: 403 });
  await expect(inventario.guardar(actor, { ...nuevo, stock_minimo: "0" })).rejects.toThrow();
  await expect(inventario.guardar(actor, { ...nuevo, stock_1: "100" })).rejects.toThrow();
  await expect(inventario.guardar(actor, { ...nuevo, categoria_id: 999 })).rejects.toMatchObject({ estado: 400 });
  const producto = await inventario.guardar(actor, nuevo);
  expect(await stock.getStock(producto.id, 1)).toBe("0.000");
  const [conteo] = await db.select({ total: sql<number>`count(*)::int` }).from(esquema.movimientos); expect(conteo.total).toBe(0);
  await db.update(esquema.usuarios).set({ rol: "admin" }).where(eq(esquema.usuarios.id, actor.id));
  await expect(inventario.guardar(actor, nuevo)).rejects.toMatchObject({ estado: 403 });
});
it("Excel exporta todas las coincidencias, columnas por vista y cantidades numericas", async () => {
  for (let indice = 0; indice < 13; indice++) await inventario.guardar(actor, { ...nuevo, nombre: `Producto ${indice}` });
  await inventario.guardar(actor, { ...nuevo, nombre: "=SUM(1,2)" });
  const datos = await inventario.listar(filtros, true);
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await exportar_inventario(datos.filas, filtros) as unknown as ExcelJS.Buffer);
  const hoja = libro.worksheets[0]; expect(hoja.rowCount).toBe(15);
  expect(hoja.getRow(1).values).toContain("Stock Bodega 1"); expect(hoja.getRow(1).values).toContain("Stock Bodega 2");
  expect(hoja.getCell("A2").value).toBe("=SUM(1,2)"); expect(hoja.getCell("E2").type).toBe(ExcelJS.ValueType.Number);
  const cocina = new ExcelJS.Workbook(); await cocina.xlsx.load(await exportar_inventario(datos.filas, { ...filtros, bodega: 2 }) as unknown as ExcelJS.Buffer);
  expect(cocina.worksheets[0].getRow(1).values).not.toContain("Stock Bodega 1");
  expect(cocina.worksheets[0].getRow(1).values).toContain("Stock Bodega 2");
});
it("normaliza parametros no validos de paginacion", () => {
  expect(leer_filtros_inventario({ pagina: "-1", registros: "999", bodega: "todas", buscar: "   arroz  " })).toMatchObject({ pagina: 1, registros: 25, bodega: null, buscar: "arroz" });
});
it("el permiso de traspaso rapido se revalida dentro de la transaccion", async () => {
  const producto = await inventario.guardar(actor, nuevo);
  const guia = { tipo: "entrada" as const, bodega_destino_id: 1, n_factura: "1", fecha: filtros.fecha, usuario_id: actor.id, items: [{ producto_id: producto.id, cantidad: "10" }] };
  await db.update(esquema.usuarios).set({ rol: "trabajador" }).where(eq(esquema.usuarios.id, actor.id));
  await expect(stock.registrarGuia(guia, { roles: ["superadmin"], version_sesion: 0 })).rejects.toMatchObject({ estado: 403 });
  await db.update(esquema.usuarios).set({ rol: "superadmin", version_sesion: 1 }).where(eq(esquema.usuarios.id, actor.id));
  await expect(stock.registrarGuia(guia, { roles: ["superadmin"], version_sesion: 0 })).rejects.toMatchObject({ estado: 401 });
  expect(await stock.getStock(producto.id, 1)).toBe("0.000");
});
