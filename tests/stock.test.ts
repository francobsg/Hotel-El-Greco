import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import * as esquema from "@/db/schema";
import { poblar_base_datos } from "@/db/seed/poblar";
import { convertir_receta_a_unidad, crear_servicio_stock, type EntradaGuia } from "@/lib/stock/servicio";

const cliente = new PGlite();
const db = drizzle(cliente, { schema: esquema });
const servicio = crear_servicio_stock(db);
const fecha = "2026-10-14";

beforeAll(async () => { await migrate(db, { migrationsFolder: "./db/migrations" }); });
afterAll(async () => { await cliente.close(); });
beforeEach(async () => {
  await cliente.exec("TRUNCATE usuarios, bodegas, categorias, productos, platillos, guias RESTART IDENTITY CASCADE; ALTER SEQUENCE folios_bodega_1 RESTART; ALTER SEQUENCE folios_bodega_2 RESTART;");
});

describe("registrarGuia", () => {
  let usuario_id: number;
  let producto_id: number;
  let otro_producto_id: number;
  let admin_id: number;
  beforeEach(async () => {
    const usuarios = await db.insert(esquema.usuarios).values([
      { nombre: "Trabajador", email: "trabajador@test.cl", password_hash: "hash_prueba", rol: "trabajador" },
      { nombre: "Admin", email: "admin@test.cl", password_hash: "hash_prueba", rol: "admin" },
    ]).returning();
    usuario_id = usuarios[0].id;
    admin_id = usuarios[1].id;
    await db.insert(esquema.bodegas).values([{ id: 1, nombre: "Principal" }, { id: 2, nombre: "Cocina" }]);
    const [categoria] = await db.insert(esquema.categorias).values({ nombre: "Carnes" }).returning();
    const productos = await db.insert(esquema.productos).values([
      { nombre: "Pollo", unidad: "kg", categoria_id: categoria.id },
      { nombre: "Vacuno", unidad: "kg", categoria_id: categoria.id },
    ]).returning();
    producto_id = productos[0].id;
    otro_producto_id = productos[1].id;
  });

  function entrada(cantidad: string | number = "10.125"): EntradaGuia {
    return { tipo: "entrada", bodega_destino_id: 1, n_factura: "F-100", fecha, usuario_id, items: [{ producto_id, cantidad }] };
  }
  function traspaso(cantidad = "2.125"): EntradaGuia {
    return { tipo: "traspaso", bodega_origen_id: 1, bodega_destino_id: 2, fecha, usuario_id, items: [{ producto_id, cantidad }] };
  }

  it("entrada: genera folio e incrementa stock desde movimientos", async () => {
    expect(await servicio.getStock(producto_id, 1)).toBe("0.000");
    const guia = await servicio.registrarGuia(entrada());
    expect(guia.folio).toBe("G1-000001");
    expect(await servicio.getStock(producto_id, 1)).toBe("10.125");
    expect((await db.select().from(esquema.guia_items))).toHaveLength(1);
    expect((await db.select().from(esquema.movimientos))[0].cantidad).toBe("10.125");
  });

  it("traspaso: debita B1 y acredita B2 en la misma guia", async () => {
    await servicio.registrarGuia(entrada());
    const guia = await servicio.registrarGuia(traspaso());
    expect(guia.folio).toBe("G1-000002");
    expect(await servicio.getStock(producto_id, 1)).toBe("8.000");
    expect(await servicio.getStock(producto_id, 2)).toBe("2.125");
    const movimientos = await db.select().from(esquema.movimientos).where(eq(esquema.movimientos.guia_id, guia.id));
    expect(movimientos.map((movimiento) => movimiento.cantidad).sort()).toEqual(["-2.125", "2.125"]);
  });

  it("rechaza stock negativo y revierte la guia completa", async () => {
    await servicio.registrarGuia(entrada());
    await expect(servicio.registrarGuia({ ...traspaso(), items: [{ producto_id, cantidad: "1" }, { producto_id: otro_producto_id, cantidad: "1" }] })).rejects.toThrow("Stock insuficiente");
    expect(await servicio.getStock(producto_id, 1)).toBe("10.125");
    expect(await servicio.getStock(producto_id, 2)).toBe("0.000");
    expect(await db.select().from(esquema.guias)).toHaveLength(1);
    expect(await db.select().from(esquema.guia_items)).toHaveLength(1);
    expect(await db.select().from(esquema.movimientos)).toHaveLength(1);
  });

  it("agrega productos repetidos antes de comprobar stock", async () => {
    await servicio.registrarGuia(entrada("1"));
    await expect(servicio.registrarGuia({ ...traspaso(), items: [{ producto_id, cantidad: "0.600" }, { producto_id, cantidad: "0.600" }] })).rejects.toThrow("Stock insuficiente");
    expect(await servicio.getStock(producto_id, 1)).toBe("1.000");
  });

  it("permite agotar exactamente el stock y mantiene decimales", async () => {
    await servicio.registrarGuia(entrada("0.300"));
    await servicio.registrarGuia(traspaso("0.100"));
    await servicio.registrarGuia(traspaso("0.200"));
    expect(await servicio.getStock(producto_id, 1)).toBe("0.000");
    expect(await servicio.getStock(producto_id, 2)).toBe("0.300");
    const guia = await servicio.registrarGuia({ tipo: "venta", bodega_origen_id: 2, fecha, usuario_id, items: [{ producto_id, cantidad: "0.300" }] });
    expect(guia.folio).toBe("G2-000001");
    expect(await servicio.getStock(producto_id, 2)).toBe("0.000");
  });

  it("admin e inactivos no escriben; trabajador no hace ajustes", async () => {
    await expect(servicio.registrarGuia({ ...entrada(), usuario_id: admin_id })).rejects.toThrow("sin permiso");
    await expect(servicio.registrarGuia({ tipo: "ajuste_positivo", bodega_destino_id: 2, fecha, usuario_id, items: [{ producto_id, cantidad: "1" }] })).rejects.toThrow("Solo superadmin");
    await db.update(esquema.usuarios).set({ activo: false }).where(eq(esquema.usuarios.id, usuario_id));
    await expect(servicio.registrarGuia(entrada())).rejects.toThrow("sin permiso");
    expect(await db.select().from(esquema.guias)).toHaveLength(0);
  });

  it("zod rechaza cantidades y rutas invalidas antes de escribir", async () => {
    for (const cantidad of [0, -1, "0.0001", "1000000000", Number.NaN]) {
      await expect(servicio.registrarGuia(entrada(cantidad))).rejects.toThrow();
    }
    await expect(servicio.registrarGuia({ ...entrada(), n_factura: undefined })).rejects.toThrow();
    await expect(servicio.registrarGuia({ ...traspaso(), bodega_destino_id: 1 })).rejects.toThrow();
    expect(await db.select().from(esquema.guias)).toHaveLength(0);
  });

  it("revierte cabecera e items si falla la insercion de movimientos", async () => {
    await cliente.exec("CREATE FUNCTION fallar_movimiento_prueba() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fallo de prueba'; END; $$; CREATE TRIGGER fallar_movimiento_prueba BEFORE INSERT ON movimientos FOR EACH ROW EXECUTE FUNCTION fallar_movimiento_prueba();");
    try {
      await expect(servicio.registrarGuia(entrada())).rejects.toThrow();
      expect(await db.select().from(esquema.guias)).toHaveLength(0);
      expect(await db.select().from(esquema.guia_items)).toHaveLength(0);
      expect(await servicio.getStock(producto_id, 1)).toBe("0.000");
    } finally {
      await cliente.exec("DROP TRIGGER fallar_movimiento_prueba ON movimientos; DROP FUNCTION fallar_movimiento_prueba();");
    }
  });
});

it("convierte gramos y ml sin asumir equivalencias para un o caja", () => {
  expect(convertir_receta_a_unidad(250, "kg")).toBe("0.250");
  expect(convertir_receta_a_unidad(1500, "lt")).toBe("1.500");
  expect(() => convertir_receta_a_unidad(1, "un")).toThrow("equivalencia");
  expect(() => convertir_receta_a_unidad("0.5", "kg")).toThrow("precision");
});

it("seed: tres roles, catalogo, recetas y 60 dias sin stock negativo", async () => {
  expect(await poblar_base_datos(db, "clave-temporal-prueba", fecha)).toEqual({ usuarios: 3, categorias: 12, productos: 60, platillos: 8, dias: 60 });
  expect(await db.select().from(esquema.usuarios)).toHaveLength(3);
  expect(await db.select().from(esquema.productos)).toHaveLength(60);
  expect((await db.select().from(esquema.recetas)).length).toBeGreaterThan(24);
  const dias = await db.execute<{ dias: number }>(sql`select count(distinct fecha)::integer as dias from movimientos`);
  expect(dias.rows[0].dias).toBe(60);
  const negativos = await db.execute(sql`select * from (
    select sum(cantidad) over (partition by producto_id, bodega_id order by fecha, id) as saldo from movimientos
  ) historico where saldo < 0`);
  expect(negativos.rows).toHaveLength(0);
  await expect(poblar_base_datos(db, "clave-temporal-prueba", fecha)).rejects.toThrow("base vacia");
  expect(await db.select().from(esquema.usuarios)).toHaveLength(3);
});
