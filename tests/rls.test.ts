import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { expect, it } from "vitest";
it("tablas y vista no exponen datos o escrituras a roles del navegador, aunque se concediera SELECT", async () => {
  const cliente = new PGlite(); const db = drizzle(cliente);
  try {
    await cliente.exec("CREATE ROLE anon; CREATE ROLE authenticated;");
    await migrate(db, { migrationsFolder: "./db/migrations" });
    await cliente.exec("INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ('Super', 'super@test.cl', 'prueba', 'superadmin'); INSERT INTO bodegas (id, nombre) VALUES (1, 'Principal'); INSERT INTO categorias (nombre) VALUES ('Categoria'); INSERT INTO productos (nombre, categoria_id, unidad) VALUES ('Pollo', 1, 'kg'); INSERT INTO guias (tipo, bodega_destino_id, fecha, usuario_id, n_factura) VALUES ('entrada', 1, current_date, 1, 'TEST'); INSERT INTO movimientos (guia_id, producto_id, bodega_id, cantidad, fecha) VALUES (1, 1, 1, 2, current_date);");
    const configuracion = await cliente.query<{ cantidad: number }>("SELECT count(*)::integer AS cantidad FROM pg_class WHERE relname IN ('usuarios','bodegas','categorias','productos','guias','guia_items','movimientos','platillos','recetas','ventas_diarias','ventas_diarias_items','ventas_temporales') AND relrowsecurity");
    expect(configuracion.rows[0].cantidad).toBe(12);
    for (const rol of ["anon", "authenticated"]) {
      await cliente.exec(`SET ROLE ${rol}`);
      await expect(cliente.query("SELECT * FROM usuarios")).rejects.toThrow();
      await expect(cliente.query("DELETE FROM movimientos")).rejects.toThrow();
      await expect(cliente.exec("TRUNCATE movimientos")).rejects.toThrow();
      await cliente.exec("RESET ROLE");
    }
    await cliente.exec("GRANT SELECT ON usuarios, movimientos, stock_actual TO anon; SET ROLE anon;");
    expect((await cliente.query("SELECT * FROM usuarios")).rows).toHaveLength(0);
    expect((await cliente.query("SELECT * FROM stock_actual")).rows).toHaveLength(0);
    await cliente.exec("RESET ROLE");
    expect((await cliente.query("SELECT * FROM movimientos")).rows).toHaveLength(1);
  } finally { await cliente.close(); }
});
