import { beforeAll, afterAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as esquema from "@/db/schema";
import { crear_servicio_guias } from "@/lib/guias/servicio";
import { crear_servicio_stock } from "@/lib/stock/servicio";
import { formulario_guia, leer_filtros_historial } from "@/lib/guias/tipos";
import { validar_stock_formulario } from "@/lib/guias/validacion";
import { exportar_guias } from "@/lib/guias/excel";
import ExcelJS from "exceljs";
import type { ProductoInventario } from "@/lib/inventario/tipos";
const producto: ProductoInventario = { id: 1, nombre: "Vacuno", categoria_id: 1, categoria: "Carnes", marca: null, unidad: "kg", stock_1: "1.125", stock_2: "0.250", stock_critico: "0", stock_minimo: "1", stock_maximo: "10", costo: "1" };
const base = { tipo: "traspaso" as const, fecha: "2026-10-14", bodega_ajuste: 1 as const, n_factura: "", glosa: "", items: [{ producto_id: 1, cantidad: "1.125", marca: "", descripcion: "" }] };
it("formulario permite agotar el saldo y rechaza exceso por 0,001; suma items repetidos", () => {
  expect(validar_stock_formulario(formulario_guia.parse(base), [producto])).toBeNull();
  expect(validar_stock_formulario({ ...base, items: [{ ...base.items[0], cantidad: "1.126" }] }, [producto])).toContain("Stock insuficiente");
  expect(validar_stock_formulario({ ...base, items: [{ ...base.items[0], cantidad: "0.750" }, { ...base.items[0], cantidad: "0.500" }] }, [producto])).toContain("Vacuno");
});
it("consumo/ajuste usan su bodega; compras no requieren saldo y unidades no se convierten", () => {
  expect(validar_stock_formulario({ ...base, tipo: "consumo" }, [producto])).toContain("Bodega 2");
  expect(validar_stock_formulario({ ...base, tipo: "consumo", items: [{ ...base.items[0], cantidad: "0.100" }] }, [{ ...producto, stock_2: "-0.125" }])).toContain("Stock insuficiente");
  expect(validar_stock_formulario({ ...base, tipo: "ajuste_negativo", bodega_ajuste: 2 }, [producto])).toContain("Bodega 2");
  expect(validar_stock_formulario({ ...base, tipo: "entrada" }, [])).toBeNull();
  expect(formulario_guia.safeParse({ ...base, tipo: "entrada", n_factura: "" }).success).toBe(false);
});
const cliente = new PGlite(); const db = drizzle(cliente, { schema: esquema });
const guias = crear_servicio_guias(db); const stock = crear_servicio_stock(db);
let usuario_id: number; let folio_entrada: string;
beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./db/migrations" });
  const [usuario] = await db.insert(esquema.usuarios).values({ nombre: "Operador", email: "prueba@test.cl", rol: "superadmin", password_hash: "hash" }).returning(); usuario_id = usuario.id;
  await db.insert(esquema.bodegas).values([{ id: 1, nombre: "Principal" }, { id: 2, nombre: "Cocina" }]);
  await db.insert(esquema.categorias).values({ id: 1, nombre: "Carnes" });
  await db.insert(esquema.productos).values({ id: 1, nombre: "Vacuno", categoria_id: 1, unidad: "kg" });
  const entrada = await stock.registrarGuia({ tipo: "entrada", fecha: "2026-10-13", usuario_id, bodega_destino_id: 1, n_factura: "FAC-10%", items: [{ producto_id: 1, cantidad: "100" }] }); folio_entrada = entrada.folio;
  for (let indice = 0; indice < 55; indice++) await stock.registrarGuia({ tipo: "traspaso", fecha: "2026-10-14", usuario_id, bodega_origen_id: 1, bodega_destino_id: 2, items: [{ producto_id: 1, cantidad: "1" }] });
});
afterAll(async () => { await cliente.close(); });
it("historial pagina guias (no duplica traspasos), ordena y exporta todas", async () => {
  const { filtros } = leer_filtros_historial({ fin: "2026-10-14" });
  const pagina = await guias.listar(filtros);
  expect(pagina).toMatchObject({ total: 56, paginas: 2, pagina: 1 }); expect(pagina.filas).toHaveLength(50);
  expect(pagina.filas[0]).toMatchObject({ tipo: "traspaso", total_items: 1, usuario: "Operador", origen: "Principal", destino: "Cocina" });
  expect((await guias.listar({ ...filtros, pagina: 99 })).filas).toHaveLength(6);
  const completo = await guias.listar(filtros, true);
  expect(completo.filas).toHaveLength(56);
  const libro = new ExcelJS.Workbook(); await libro.xlsx.load(await exportar_guias(completo.filas) as unknown as ExcelJS.Buffer);
  expect(libro.worksheets[0].rowCount).toBe(57);
  expect(libro.worksheets[0].getCell("F2").value).toBe(1);
});
it("filtros de folio/factura, rango y tipo; detalle se limita al propietario", async () => {
  const { filtros } = leer_filtros_historial({ folio: "10%", inicio: "2026-10-13", fin: "2026-10-13", tipo: "entrada", bodega: "1" });
  expect((await guias.listar(filtros)).filas[0].folio).toBe(folio_entrada);
  expect((await guias.listar({ ...filtros, bodega: 2 })).total).toBe(0);
  const detalle = await guias.detalle(folio_entrada, usuario_id);
  expect(detalle.items[0]).toMatchObject({ producto: "Vacuno", cantidad: "100.000", unidad: "kg" });
  await expect(guias.detalle(folio_entrada, usuario_id + 1)).rejects.toMatchObject({ estado: 404 });
  expect(leer_filtros_historial({ inicio: "2026-10-14", fin: "2026-10-13" }).aviso).toBeTruthy();
});
it("reenvio confirmado de la misma foto devuelve la guia original sin duplicar stock", async () => {
  const saldo = await stock.getStock(1, 1);
  const input = { tipo: "entrada" as const, fecha: "2026-10-14", usuario_id, bodega_destino_id: 1, n_factura: "OCR-1", imagen_factura_url: "http://localhost/escaner/imagen/local/1/11111111-1111-4111-8111-111111111111.jpg", items: [{ producto_id: 1, cantidad: "2.500" }] };
  const permiso = { roles: ["superadmin"] as const, version_sesion: 0, factura_unica: true };
  const primera = await stock.registrarGuia(input, permiso);
  const reenvio = await stock.registrarGuia(input, permiso);
  expect(reenvio.folio).toBe(primera.folio);
  expect(Number(await stock.getStock(1, 1))).toBe(Number(saldo) + 2.5);
});
