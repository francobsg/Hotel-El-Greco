import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, numeric, pgEnum, pgSequence, pgTable, pgView, primaryKey, serial, text, timestamp, unique, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const rol_usuario = pgEnum("rol_usuario", ["superadmin", "admin", "trabajador"]);
export const unidad_producto = pgEnum("unidad_producto", ["kg", "lt", "un", "caja"]);
export const tipo_guia = pgEnum("tipo_guia", ["entrada", "salida", "traspaso", "consumo", "ajuste_positivo", "ajuste_negativo", "venta"]);
export const folios_bodega_1 = pgSequence("folios_bodega_1", { startWith: 1, maxValue: 999999 });
export const folios_bodega_2 = pgSequence("folios_bodega_2", { startWith: 1, maxValue: 999999 });

export const usuarios = pgTable("usuarios", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 150 }).notNull(),
  email: varchar("email", { length: 254 }).notNull().unique(),
  password_hash: text("password_hash").notNull(),
  rol: rol_usuario("rol").notNull(),
  activo: boolean("activo").notNull().default(true),
  version_sesion: integer("version_sesion").notNull().default(0),
  creado_en: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
}, (tabla) => [uniqueIndex("usuarios_email_normalizado_idx").on(sql`lower(${tabla.email})`)]).enableRLS();

export const bodegas = pgTable("bodegas", {
  id: integer("id").primaryKey(),
  nombre: varchar("nombre", { length: 100 }).notNull().unique(),
}, (tabla) => [check("bodegas_dos_bodegas", sql`${tabla.id} in (1, 2)`)]).enableRLS();

export const categorias = pgTable("categorias", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 100 }).notNull().unique(),
  grupo_grafico: varchar("grupo_grafico", { length: 100 }),
}).enableRLS();

export const productos = pgTable("productos", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 150 }).notNull(),
  categoria_id: integer("categoria_id").notNull().references(() => categorias.id),
  unidad: unidad_producto("unidad").notNull(),
  marca: varchar("marca", { length: 100 }),
  stock_critico: numeric("stock_critico", { precision: 12, scale: 3 }).notNull().default("0"),
  stock_minimo: numeric("stock_minimo", { precision: 12, scale: 3 }).notNull().default("0"),
  stock_maximo: numeric("stock_maximo", { precision: 12, scale: 3 }).notNull().default("0"),
  costo: numeric("costo", { precision: 12, scale: 2 }).notNull().default("0"),
}, (tabla) => [
  index("productos_categoria_idx").on(tabla.categoria_id),
  check("productos_umbrales_validos", sql`0 <= ${tabla.stock_critico} and ${tabla.stock_critico} <= ${tabla.stock_minimo} and ${tabla.stock_minimo} <= ${tabla.stock_maximo}`),
  check("productos_costo_no_negativo", sql`${tabla.costo} >= 0`),
]).enableRLS();

export const estado_alertas_stock = pgTable("estado_alertas_stock", {
  producto_id: integer("producto_id").notNull().references(() => productos.id, { onDelete: "cascade" }),
  bodega_id: integer("bodega_id").notNull().references(() => bodegas.id, { onDelete: "cascade" }),
  ignorada_hasta: timestamp("ignorada_hasta", { withTimezone: true }),
}, (tabla) => [primaryKey({ columns: [tabla.producto_id, tabla.bodega_id] })]).enableRLS();

export const guias = pgTable("guias", {
  id: serial("id").primaryKey(),
  // El trigger de la migracion asigna el folio antes de insertar.
  folio: varchar("folio", { length: 9 }).notNull().default("").unique(),
  tipo: tipo_guia("tipo").notNull(),
  bodega_origen_id: integer("bodega_origen_id").references(() => bodegas.id),
  bodega_destino_id: integer("bodega_destino_id").references(() => bodegas.id),
  n_factura: varchar("n_factura", { length: 100 }),
  fecha: date("fecha").notNull(),
  glosa: text("glosa"),
  usuario_id: integer("usuario_id").notNull().references(() => usuarios.id),
  imagen_factura_url: text("imagen_factura_url"),
  provisional: boolean("provisional").notNull().default(false),
  clave_venta: uuid("clave_venta").unique(),
  creado_en: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
}, (tabla) => [
  index("guias_fecha_idx").on(tabla.fecha),
  index("guias_usuario_idx").on(tabla.usuario_id),
  index("guias_imagen_factura_idx").on(tabla.imagen_factura_url),
  check("guias_provisional_venta", sql`not ${tabla.provisional} or ${tabla.tipo} = 'venta'`),
  check("guias_clave_venta_provisional", sql`${tabla.clave_venta} is null or (${tabla.tipo} = 'venta' and ${tabla.provisional})`),
  check("guias_bodegas_segun_tipo", sql`
    (${tabla.tipo} in ('entrada', 'ajuste_positivo') and ${tabla.bodega_origen_id} is null and ${tabla.bodega_destino_id} is not null)
    or (${tabla.tipo} in ('salida', 'consumo', 'ajuste_negativo', 'venta') and ${tabla.bodega_origen_id} is not null and ${tabla.bodega_destino_id} is null)
    or (${tabla.tipo} = 'traspaso' and ${tabla.bodega_origen_id} is not null and ${tabla.bodega_destino_id} is not null and ${tabla.bodega_origen_id} = 1 and ${tabla.bodega_destino_id} = 2)`),
  check("guias_entrada_principal_factura", sql`${tabla.tipo} <> 'entrada' or (${tabla.bodega_destino_id} = 1 and ${tabla.n_factura} is not null and length(trim(${tabla.n_factura})) > 0)`),
  check("guias_caja_en_cocina", sql`${tabla.tipo} not in ('consumo', 'venta') or ${tabla.bodega_origen_id} = 2`),
]).enableRLS();

export const guia_items = pgTable("guia_items", {
  id: serial("id").primaryKey(),
  guia_id: integer("guia_id").notNull().references(() => guias.id),
  producto_id: integer("producto_id").notNull().references(() => productos.id),
  cantidad: numeric("cantidad", { precision: 12, scale: 3 }).notNull(),
  marca: varchar("marca", { length: 100 }),
  descripcion: text("descripcion"),
}, (tabla) => [
  index("guia_items_guia_idx").on(tabla.guia_id),
  check("guia_items_cantidad_positiva", sql`${tabla.cantidad} > 0`),
]).enableRLS();

export const movimientos = pgTable("movimientos", {
  id: serial("id").primaryKey(),
  guia_id: integer("guia_id").notNull().references(() => guias.id),
  producto_id: integer("producto_id").notNull().references(() => productos.id),
  bodega_id: integer("bodega_id").notNull().references(() => bodegas.id),
  cantidad: numeric("cantidad", { precision: 12, scale: 3 }).notNull(),
  fecha: date("fecha").notNull(),
  creado_en: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
}, (tabla) => [
  index("movimientos_producto_bodega_fecha_idx").on(tabla.producto_id, tabla.bodega_id, tabla.fecha),
  index("movimientos_guia_idx").on(tabla.guia_id),
  index("movimientos_bodega_fecha_idx").on(tabla.bodega_id, tabla.fecha),
  index("movimientos_fecha_id_idx").on(tabla.fecha, tabla.id),
  check("movimientos_cantidad_no_cero", sql`${tabla.cantidad} <> 0`),
]).enableRLS();

export const platillos = pgTable("platillos", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 150 }).notNull().unique(),
  precio: numeric("precio", { precision: 12, scale: 2 }),
  activo: boolean("activo").notNull().default(true),
}, (tabla) => [check("platillos_precio_no_negativo", sql`${tabla.precio} is null or ${tabla.precio} >= 0`)]).enableRLS();

export const recetas = pgTable("recetas", {
  id: serial("id").primaryKey(),
  platillo_id: integer("platillo_id").notNull().references(() => platillos.id),
  producto_id: integer("producto_id").notNull().references(() => productos.id),
  gramos_o_ml: numeric("gramos_o_ml", { precision: 12, scale: 3 }).notNull(),
}, (tabla) => [
  unique("recetas_platillo_producto_unico").on(tabla.platillo_id, tabla.producto_id),
  index("recetas_producto_idx").on(tabla.producto_id),
  check("recetas_cantidad_positiva", sql`${tabla.gramos_o_ml} > 0`),
]).enableRLS();

export const ventas_temporales = pgTable("ventas_temporales", {
  id: serial("id").primaryKey(),
  guia_id: integer("guia_id").notNull().references(() => guias.id),
  platillo_id: integer("platillo_id").notNull().references(() => platillos.id),
  cantidad: integer("cantidad").notNull(),
  fecha: date("fecha").notNull(),
  hora: timestamp("hora", { withTimezone: true }).notNull().defaultNow(),
  usuario_id: integer("usuario_id").notNull().references(() => usuarios.id),
}, (tabla) => [
  unique("ventas_temporales_guia_platillo").on(tabla.guia_id, tabla.platillo_id),
  index("ventas_temporales_fecha_idx").on(tabla.fecha),
  index("ventas_temporales_platillo_idx").on(tabla.platillo_id),
  check("ventas_temporales_cantidad_positiva", sql`${tabla.cantidad} > 0`),
]).enableRLS();

export const ventas_diarias = pgTable("ventas_diarias", {
  id: serial("id").primaryKey(),
  fecha: date("fecha").notNull().unique(),
  archivo_url: text("archivo_url").notNull(),
  total_platos: integer("total_platos").notNull(),
  procesado_en: timestamp("procesado_en", { withTimezone: true }).notNull().defaultNow(),
  usuario_id: integer("usuario_id").notNull().references(() => usuarios.id),
}, (tabla) => [check("ventas_diarias_total_no_negativo", sql`${tabla.total_platos} >= 0`)]).enableRLS();

export const ventas_diarias_items = pgTable("ventas_diarias_items", {
  id: serial("id").primaryKey(),
  venta_diaria_id: integer("venta_diaria_id").notNull().references(() => ventas_diarias.id),
  platillo_id: integer("platillo_id").notNull().references(() => platillos.id),
  cantidad: integer("cantidad").notNull(),
}, (tabla) => [
  unique("ventas_diarias_items_platillo_unico").on(tabla.venta_diaria_id, tabla.platillo_id),
  index("ventas_diarias_items_platillo_idx").on(tabla.platillo_id),
  check("ventas_diarias_items_cantidad_positiva", sql`${tabla.cantidad} > 0`),
]).enableRLS();

export const stock_actual = pgView("stock_actual", {
  producto_id: integer("producto_id").notNull(),
  bodega_id: integer("bodega_id").notNull(),
  cantidad: numeric("cantidad").notNull(),
}).with({ securityInvoker: true }).as(sql`select producto_id, bodega_id, sum(cantidad) as cantidad from movimientos group by producto_id, bodega_id`);
