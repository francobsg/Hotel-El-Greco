import { hash } from "bcryptjs";
import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";

import * as esquema from "@/db/schema";
import { catalogo, menu } from "@/db/seed/datos";
import { convertir_receta_a_unidad, crear_servicio_stock } from "@/lib/stock/servicio";

export async function poblar_base_datos<Resultado extends PgQueryResultHKT>(db: PgDatabase<Resultado, typeof esquema>, password: string, fecha_corte: string) {
  z.string().min(12).max(72).refine((clave) => Buffer.byteLength(clave, "utf8") <= 72, "La clave no debe superar 72 bytes.").parse(password);
  z.iso.date().parse(fecha_corte);
  const password_hash = await hash(password, 12);
  return db.transaction(async (tx) => {
    // Solo bases nuevas; evita duplicar historia o cambiar cuentas existentes.
    await tx.execute(sql`lock table usuarios, bodegas, categorias, productos, platillos, guias in share row exclusive mode`);
    for (const tabla of [esquema.usuarios, esquema.bodegas, esquema.categorias, esquema.productos, esquema.platillos, esquema.guias]) {
      const existentes = await tx.select({ id: tabla.id }).from(tabla).limit(1);
      if (existentes.length) throw new Error("Seed cancelado: requiere una base vacia y migrada; no se modificaron datos existentes.");
    }
    const [superadmin] = await tx.insert(esquema.usuarios).values([
      { nombre: "Superadmin Hotel El Greco", email: "admin@hotelgreco.cl", password_hash, rol: "superadmin" },
      { nombre: "Administrador de prueba", email: "admin.prueba@hotelgreco.cl", password_hash, rol: "admin" },
      { nombre: "Trabajador de prueba", email: "trabajador.prueba@hotelgreco.cl", password_hash, rol: "trabajador" },
    ]).returning();
    await tx.insert(esquema.bodegas).values([{ id: 1, nombre: "Bodega 1 (Principal)" }, { id: 2, nombre: "Bodega 2 (Cocina)" }]);
    const por_nombre = new Map<string, typeof esquema.productos.$inferSelect>();
    for (const categoria of catalogo) {
      const [registrada] = await tx.insert(esquema.categorias).values({ nombre: categoria.nombre, grupo_grafico: categoria.grupo_grafico }).returning();
      const productos = await tx.insert(esquema.productos).values(categoria.productos.map(([nombre, unidad, costo]) => ({
        nombre, unidad, costo: String(costo), categoria_id: registrada.id, stock_critico: "1", stock_minimo: "5", stock_maximo: "100",
      }))).returning();
      for (const producto of productos) por_nombre.set(producto.nombre, producto);
    }
    const recetas: { producto_id: number; gramos: number; platillo: number }[] = [];
    for (const [indice, platillo] of menu.entries()) {
      const [registrado] = await tx.insert(esquema.platillos).values({ nombre: platillo.nombre, precio: String(platillo.precio) }).returning();
      const ingredientes = Object.entries(platillo.ingredientes).map(([nombre, gramos]) => {
        const producto = por_nombre.get(nombre);
        if (!producto || gramos === undefined) throw new Error(`Ingrediente de seed no encontrado: ${nombre}`);
        recetas.push({ producto_id: producto.id, gramos, platillo: indice });
        return { platillo_id: registrado.id, producto_id: producto.id, gramos_o_ml: String(gramos) };
      });
      await tx.insert(esquema.recetas).values(ingredientes);
    }
    const demanda_base = new Map<number, number>();
    for (const receta of recetas) demanda_base.set(receta.producto_id, (demanda_base.get(receta.producto_id) ?? 0) + receta.gramos * 3);
    const servicio = crear_servicio_stock(tx);
    for (let dia = 0; dia < 60; dia++) {
      const fecha = new Date(`${fecha_corte}T12:00:00Z`);
      fecha.setUTCDate(fecha.getUTCDate() - 59 + dia);
      const fecha_guia = fecha.toISOString().slice(0, 10);
      if (dia === 0 || dia % 7 === 0) {
        const items_entrada = dia === 0 ? [...por_nombre.values()].map((producto) => ({ producto_id: producto.id, cantidad: producto.unidad === "un" ? "100" : producto.unidad === "caja" ? "10" : "50" }))
          : [...demanda_base].map(([producto_id, gramos]) => ({ producto_id, cantidad: convertir_receta_a_unidad(gramos * 14, por_nombre_producto(producto_id).unidad) }));
        await servicio.registrarGuia({ tipo: "entrada", bodega_destino_id: 1, n_factura: `DEMO-${String(dia + 1).padStart(4, "0")}`, fecha: fecha_guia, usuario_id: superadmin.id, glosa: "Abastecimiento de demostracion", items: items_entrada });
        await servicio.registrarGuia({ tipo: "traspaso", bodega_origen_id: 1, bodega_destino_id: 2, fecha: fecha_guia, usuario_id: superadmin.id, glosa: "Abastecimiento semanal de cocina", items: [...demanda_base].map(([producto_id, gramos]) => ({ producto_id, cantidad: convertir_receta_a_unidad(gramos * (dia === 0 ? 10 : 7), por_nombre_producto(producto_id).unidad) })) });
      }
      const consumo = new Map<number, number>();
      for (const receta of recetas) consumo.set(receta.producto_id, (consumo.get(receta.producto_id) ?? 0) + receta.gramos * (2 + (dia + receta.platillo) % 3));
      await servicio.registrarGuia({ tipo: "venta", bodega_origen_id: 2, fecha: fecha_guia, usuario_id: superadmin.id, glosa: "Venta de platillos de demostracion, descontada segun recetas", items: [...consumo].map(([producto_id, gramos]) => ({ producto_id, cantidad: convertir_receta_a_unidad(gramos, por_nombre_producto(producto_id).unidad) })) });
    }
    function por_nombre_producto(id: number) {
      const producto = [...por_nombre.values()].find((producto) => producto.id === id);
      if (!producto) throw new Error(`Producto de seed no encontrado: ${id}`);
      return producto;
    }
    return { usuarios: 3, categorias: catalogo.length, productos: por_nombre.size, platillos: menu.length, dias: 60 };
  });
}
