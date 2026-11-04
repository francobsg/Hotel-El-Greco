import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import * as esquema from "@/db/schema";
import type { UsuarioSesion } from "@/lib/auth/permisos";
import { crear_servicio_caja } from "@/lib/caja/servicio";
import { calcular_ingredientes } from "@/lib/caja/calculos";
import { conciliarDia } from "@/lib/caja";
import { crear_servicio_stock } from "@/lib/stock/servicio";
import { fecha_chile } from "@/lib/stats/tipos";
import { MockOcr } from "@/lib/ocr/MockOcr";
import { emparejar_platillos } from "@/lib/ocr/coincidencias";

const cliente = new PGlite();
const db = drizzle(cliente, { schema: esquema });
const caja = crear_servicio_caja(db), stock = crear_servicio_stock(db);
const actor: UsuarioSesion = { id: 1, nombre: "Mesero", email: "mesero@test.cl", rol: "trabajador", version_sesion: 0, movil: true };
const venta = (cantidad = 2) => ({ clave: randomUUID(), confirmada: true as const, items: [{ platillo_id: 1, cantidad }, { platillo_id: 2, cantidad: 1 }] });
beforeAll(async () => { await migrate(db, { migrationsFolder: "./db/migrations" }); });
afterAll(async () => { await cliente.close(); });
beforeEach(async () => {
  await cliente.exec("TRUNCATE usuarios, bodegas, categorias, productos, platillos, guias RESTART IDENTITY CASCADE; ALTER SEQUENCE folios_bodega_1 RESTART; ALTER SEQUENCE folios_bodega_2 RESTART;");
  await db.insert(esquema.usuarios).values({ nombre: actor.nombre, email: actor.email, rol: actor.rol, password_hash: "prueba" });
  await db.insert(esquema.bodegas).values([{ id: 1, nombre: "Principal" }, { id: 2, nombre: "Cocina" }]);
  await db.insert(esquema.categorias).values({ nombre: "Prueba" });
  await db.insert(esquema.productos).values([{ nombre: "Arroz", categoria_id: 1, unidad: "kg", stock_critico: "0.1", stock_minimo: "0.5", stock_maximo: "10" }, { nombre: "Aceite", categoria_id: 1, unidad: "lt" }]);
  await db.insert(esquema.platillos).values([{ nombre: "Arroz con pollo", precio: "9000" }, { nombre: "Arroz con verduras" }]);
  await db.insert(esquema.recetas).values([{ platillo_id: 1, producto_id: 1, gramos_o_ml: "100" }, { platillo_id: 1, producto_id: 2, gramos_o_ml: "10" }, { platillo_id: 2, producto_id: 1, gramos_o_ml: "150" }]);
  await stock.registrarGuia({ tipo: "entrada", bodega_destino_id: 1, n_factura: "TEST", usuario_id: 1, fecha: fecha_chile(), items: [{ producto_id: 1, cantidad: "10" }, { producto_id: 2, cantidad: "10" }] });
  await stock.registrarGuia({ tipo: "traspaso", bodega_origen_id: 1, bodega_destino_id: 2, usuario_id: 1, fecha: fecha_chile(), items: [{ producto_id: 1, cantidad: "1" }, { producto_id: 2, cantidad: "1" }] });
});
it("confirma platillos y descuenta ingredientes compartidos solo de B2 en una guia provisional", async () => {
  const registrada = await caja.registrar_venta(actor, venta());
  expect(registrada).toMatchObject({ folio: "G2-000001", total_platos: 3, provisional: true });
  const [guia] = await db.select().from(esquema.guias).where(eq(esquema.guias.id, registrada.guia_id));
  expect(guia).toMatchObject({ tipo: "venta", provisional: true, usuario_id: 1, bodega_origen_id: 2 });
  expect(await stock.getStock(1, 2)).toBe("0.650"); expect(await stock.getStock(2, 2)).toBe("0.980"); expect(await stock.getStock(1, 1)).toBe("9.000");
  expect(await db.select().from(esquema.ventas_temporales)).toHaveLength(2);
  const resumen = (await caja.datos()).resumen;
  expect(resumen.platos.map((p) => p.cantidad)).toEqual([2, 1]);
  expect(resumen.ingredientes.find((p) => p.producto_id === 1)?.cantidad).toBe("0.350");
});
it("reintentar la misma confirmacion no duplica descuentos; reutilizar clave con otro pedido falla", async () => {
  const input = venta();
  const primera = await caja.registrar_venta(actor, input);
  expect(await caja.registrar_venta(actor, input)).toEqual(primera);
  expect(await stock.getStock(1, 2)).toBe("0.650");
  await expect(caja.registrar_venta(actor, { ...input, items: [{ platillo_id: 1, cantidad: 5 }] })).rejects.toMatchObject({ estado: 409 });
  expect(await db.select().from(esquema.ventas_temporales)).toHaveLength(2);
});
it("stock insuficiente revierte venta, guia, items y movimientos completos", async () => {
  await expect(caja.registrar_venta(actor, venta(9))).rejects.toMatchObject({ estado: 409 });
  expect(await db.select().from(esquema.ventas_temporales)).toHaveLength(0);
  expect(await db.select().from(esquema.guias)).toHaveLength(2);
  expect(await db.select().from(esquema.guia_items)).toHaveLength(4);
  expect(await db.select().from(esquema.movimientos)).toHaveLength(6);
  expect(await stock.getStock(1, 2)).toBe("1.000");
});
it("valida confirmacion, cantidades enteras y rol vigente en BD", async () => {
  await expect(caja.registrar_venta(actor, { ...venta(), confirmada: false } as never)).rejects.toThrow();
  await expect(caja.registrar_venta(actor, venta(1.5))).rejects.toThrow();
  await db.update(esquema.usuarios).set({ rol: "admin" }).where(eq(esquema.usuarios.id, 1));
  await expect(caja.registrar_venta(actor, venta())).rejects.toMatchObject({ estado: 403 });
  await db.update(esquema.usuarios).set({ activo: false }).where(eq(esquema.usuarios.id, 1));
  await expect(caja.registrar_venta(actor, venta())).rejects.toMatchObject({ estado: 401 });
  expect(await db.select().from(esquema.ventas_temporales)).toHaveLength(0);
});
it("revierte incluso la guia y sus descuentos si falla el registro temporal posterior", async () => {
  await cliente.exec("CREATE FUNCTION fallar_venta_prueba() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fallo de prueba'; END; $$; CREATE TRIGGER fallar_venta_prueba BEFORE INSERT ON ventas_temporales FOR EACH ROW EXECUTE FUNCTION fallar_venta_prueba();");
  try {
    await expect(caja.registrar_venta(actor, venta())).rejects.toThrow();
    expect(await db.select().from(esquema.guias)).toHaveLength(2);
    expect(await db.select().from(esquema.ventas_temporales)).toHaveLength(0);
    expect(await stock.getStock(1, 2)).toBe("1.000");
    expect(await stock.getStock(2, 2)).toBe("1.000");
  } finally {
    await cliente.exec("DROP TRIGGER fallar_venta_prueba ON ventas_temporales; DROP FUNCTION fallar_venta_prueba();");
  }
});
it("rechaza platillos inactivos, sin receta y equivalencias no definidas", async () => {
  await db.update(esquema.platillos).set({ activo: false }).where(eq(esquema.platillos.id, 1));
  await expect(caja.registrar_venta(actor, venta())).rejects.toMatchObject({ estado: 422 });
  await db.update(esquema.platillos).set({ activo: true });
  await db.delete(esquema.recetas).where(eq(esquema.recetas.platillo_id, 1));
  await expect(caja.registrar_venta(actor, venta())).rejects.toThrow("sin receta");
  await db.insert(esquema.recetas).values({ platillo_id: 1, producto_id: 2, gramos_o_ml: "10" });
  await db.update(esquema.productos).set({ unidad: "un" }).where(eq(esquema.productos.id, 2));
  await expect(caja.registrar_venta(actor, venta())).rejects.toThrow("equivalencia");
  expect(await db.select().from(esquema.ventas_temporales)).toHaveLength(0);
});
it("el resumen conserva el descuento historico aunque cambie la receta, y los dias cuentan platos", async () => {
  await caja.registrar_venta(actor, venta());
  await db.update(esquema.recetas).set({ gramos_o_ml: "800" });
  const datos = await caja.datos();
  expect(datos.resumen.ingredientes.find((i) => i.producto_id === 1)?.cantidad).toBe("0.350");
  expect(datos.resumen.registros[0]).toMatchObject({ usuario: actor.nombre, folio: "G2-000001" });
  expect(await caja.dias()).toEqual([{ fecha: fecha_chile(), total: 3 }]);
  expect(await db.select().from(esquema.ventas_diarias)).toHaveLength(0);
});
it("alertas y disponibilidad reflejan el descuento, inclusive agotado", async () => {
  await caja.registrar_venta(actor, { ...venta(), items: [{ platillo_id: 1, cantidad: 10 }] });
  const datos = await caja.datos();
  expect(datos.menu.find((p) => p.id === 1)?.disponible).toBe(0);
  expect(datos.resumen.alertas).toContainEqual({ producto_id: 1, nombre: "Arroz", unidad: "kg", cantidad: "0", estado: "critico" });
});
it("suma gramos exactos antes de convertir a kg, sin redondear ni asumir cajas", () => {
  const receta = { platillo_id: 1, producto_id: 1, gramos_o_ml: "100.500", unidad: "kg" as const, nombre: "Arroz" };
  expect(calcular_ingredientes([{ platillo_id: 1, cantidad: 2 }], [receta])).toEqual([{ producto_id: 1, cantidad: "0.201" }]);
  expect(() => calcular_ingredientes([{ platillo_id: 1, cantidad: 1 }], [receta])).toThrow("3 decimales");
});
it("boleta mock sugiere platillos; ambiguos y cantidades fraccionarias requieren correccion", async () => {
  const boleta = await new MockOcr("boleta").reconocer(new Uint8Array());
  expect(boleta.items[0]).toMatchObject({ descripcion: "Pollo con arroz", cantidad: 2 });
  const platos = [{ id: 1, nombre: "Pollo con arroz" }];
  expect(emparejar_platillos(boleta.items, platos)[0]).toMatchObject({ platillo_id: 1, cantidad: 2 });
  expect(emparejar_platillos(boleta.items, [...platos, { id: 2, nombre: "Pollo con arroz" }])[0].platillo_id).toBeNull();
  expect(emparejar_platillos([{ ...boleta.items[0], cantidad: 1.5 }], platos)[0].cantidad).toBeNull();
  expect(await db.select().from(esquema.ventas_temporales)).toHaveLength(0);
});
it("conciliarDia es solo un punto de extension no implementado", async () => {
  await expect(conciliarDia(fecha_chile(), { fecha: fecha_chile(), items: [] })).rejects.toThrow("No implementado");
  expect(await db.select().from(esquema.ventas_diarias)).toHaveLength(0);
});
