CREATE TYPE "public"."rol_usuario" AS ENUM('superadmin', 'admin', 'trabajador');--> statement-breakpoint
CREATE TYPE "public"."tipo_guia" AS ENUM('entrada', 'salida', 'traspaso', 'consumo', 'ajuste_positivo', 'ajuste_negativo', 'venta');--> statement-breakpoint
CREATE TYPE "public"."unidad_producto" AS ENUM('kg', 'lt', 'un', 'caja');--> statement-breakpoint
CREATE SEQUENCE "public"."folios_bodega_1" INCREMENT BY 1 MINVALUE 1 MAXVALUE 999999 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."folios_bodega_2" INCREMENT BY 1 MINVALUE 1 MAXVALUE 999999 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "bodegas" (
	"id" integer PRIMARY KEY NOT NULL,
	"nombre" varchar(100) NOT NULL,
	CONSTRAINT "bodegas_nombre_unique" UNIQUE("nombre"),
	CONSTRAINT "bodegas_dos_bodegas" CHECK ("bodegas"."id" in (1, 2))
);
--> statement-breakpoint
CREATE TABLE "categorias" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"grupo_grafico" varchar(100),
	CONSTRAINT "categorias_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "guia_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"guia_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"cantidad" numeric(12, 3) NOT NULL,
	"marca" varchar(100),
	"descripcion" text,
	CONSTRAINT "guia_items_cantidad_positiva" CHECK ("guia_items"."cantidad" > 0)
);
--> statement-breakpoint
CREATE TABLE "guias" (
	"id" serial PRIMARY KEY NOT NULL,
	"folio" varchar(9) DEFAULT '' NOT NULL,
	"tipo" "tipo_guia" NOT NULL,
	"bodega_origen_id" integer,
	"bodega_destino_id" integer,
	"n_factura" varchar(100),
	"fecha" date NOT NULL,
	"glosa" text,
	"usuario_id" integer NOT NULL,
	"imagen_factura_url" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guias_folio_unique" UNIQUE("folio"),
	CONSTRAINT "guias_bodegas_segun_tipo" CHECK (
    ("guias"."tipo" in ('entrada', 'ajuste_positivo') and "guias"."bodega_origen_id" is null and "guias"."bodega_destino_id" is not null)
    or ("guias"."tipo" in ('salida', 'consumo', 'ajuste_negativo', 'venta') and "guias"."bodega_origen_id" is not null and "guias"."bodega_destino_id" is null)
    or ("guias"."tipo" = 'traspaso' and "guias"."bodega_origen_id" is not null and "guias"."bodega_destino_id" is not null and "guias"."bodega_origen_id" = 1 and "guias"."bodega_destino_id" = 2)),
	CONSTRAINT "guias_entrada_principal_factura" CHECK ("guias"."tipo" <> 'entrada' or ("guias"."bodega_destino_id" = 1 and "guias"."n_factura" is not null and length(trim("guias"."n_factura")) > 0)),
	CONSTRAINT "guias_caja_en_cocina" CHECK ("guias"."tipo" not in ('consumo', 'venta') or "guias"."bodega_origen_id" = 2)
);
--> statement-breakpoint
CREATE TABLE "movimientos" (
	"id" serial PRIMARY KEY NOT NULL,
	"guia_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"bodega_id" integer NOT NULL,
	"cantidad" numeric(12, 3) NOT NULL,
	"fecha" date NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movimientos_cantidad_no_cero" CHECK ("movimientos"."cantidad" <> 0)
);
--> statement-breakpoint
CREATE TABLE "platillos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(150) NOT NULL,
	"precio" numeric(12, 2),
	"activo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "platillos_nombre_unique" UNIQUE("nombre"),
	CONSTRAINT "platillos_precio_no_negativo" CHECK ("platillos"."precio" is null or "platillos"."precio" >= 0)
);
--> statement-breakpoint
CREATE TABLE "productos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(150) NOT NULL,
	"categoria_id" integer NOT NULL,
	"unidad" "unidad_producto" NOT NULL,
	"marca" varchar(100),
	"stock_critico" numeric(12, 3) DEFAULT '0' NOT NULL,
	"stock_minimo" numeric(12, 3) DEFAULT '0' NOT NULL,
	"stock_maximo" numeric(12, 3) DEFAULT '0' NOT NULL,
	"costo" numeric(12, 2) DEFAULT '0' NOT NULL,
	CONSTRAINT "productos_umbrales_validos" CHECK (0 <= "productos"."stock_critico" and "productos"."stock_critico" <= "productos"."stock_minimo" and "productos"."stock_minimo" <= "productos"."stock_maximo"),
	CONSTRAINT "productos_costo_no_negativo" CHECK ("productos"."costo" >= 0)
);
--> statement-breakpoint
CREATE TABLE "recetas" (
	"id" serial PRIMARY KEY NOT NULL,
	"platillo_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"gramos_o_ml" numeric(12, 3) NOT NULL,
	CONSTRAINT "recetas_platillo_producto_unico" UNIQUE("platillo_id","producto_id"),
	CONSTRAINT "recetas_cantidad_positiva" CHECK ("recetas"."gramos_o_ml" > 0)
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(150) NOT NULL,
	"email" varchar(254) NOT NULL,
	"password_hash" text NOT NULL,
	"rol" "rol_usuario" NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "ventas_diarias" (
	"id" serial PRIMARY KEY NOT NULL,
	"fecha" date NOT NULL,
	"archivo_url" text NOT NULL,
	"total_platos" integer NOT NULL,
	"procesado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"usuario_id" integer NOT NULL,
	CONSTRAINT "ventas_diarias_fecha_unique" UNIQUE("fecha"),
	CONSTRAINT "ventas_diarias_total_no_negativo" CHECK ("ventas_diarias"."total_platos" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ventas_diarias_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"venta_diaria_id" integer NOT NULL,
	"platillo_id" integer NOT NULL,
	"cantidad" integer NOT NULL,
	CONSTRAINT "ventas_diarias_items_platillo_unico" UNIQUE("venta_diaria_id","platillo_id"),
	CONSTRAINT "ventas_diarias_items_cantidad_positiva" CHECK ("ventas_diarias_items"."cantidad" > 0)
);
--> statement-breakpoint
ALTER TABLE "guia_items" ADD CONSTRAINT "guia_items_guia_id_guias_id_fk" FOREIGN KEY ("guia_id") REFERENCES "public"."guias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guia_items" ADD CONSTRAINT "guia_items_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guias" ADD CONSTRAINT "guias_bodega_origen_id_bodegas_id_fk" FOREIGN KEY ("bodega_origen_id") REFERENCES "public"."bodegas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guias" ADD CONSTRAINT "guias_bodega_destino_id_bodegas_id_fk" FOREIGN KEY ("bodega_destino_id") REFERENCES "public"."bodegas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guias" ADD CONSTRAINT "guias_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_guia_id_guias_id_fk" FOREIGN KEY ("guia_id") REFERENCES "public"."guias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_bodega_id_bodegas_id_fk" FOREIGN KEY ("bodega_id") REFERENCES "public"."bodegas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recetas" ADD CONSTRAINT "recetas_platillo_id_platillos_id_fk" FOREIGN KEY ("platillo_id") REFERENCES "public"."platillos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recetas" ADD CONSTRAINT "recetas_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas_diarias" ADD CONSTRAINT "ventas_diarias_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas_diarias_items" ADD CONSTRAINT "ventas_diarias_items_venta_diaria_id_ventas_diarias_id_fk" FOREIGN KEY ("venta_diaria_id") REFERENCES "public"."ventas_diarias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas_diarias_items" ADD CONSTRAINT "ventas_diarias_items_platillo_id_platillos_id_fk" FOREIGN KEY ("platillo_id") REFERENCES "public"."platillos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guia_items_guia_idx" ON "guia_items" USING btree ("guia_id");--> statement-breakpoint
CREATE INDEX "guias_fecha_idx" ON "guias" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "movimientos_producto_bodega_fecha_idx" ON "movimientos" USING btree ("producto_id","bodega_id","fecha");--> statement-breakpoint
CREATE INDEX "movimientos_guia_idx" ON "movimientos" USING btree ("guia_id");--> statement-breakpoint
CREATE INDEX "productos_categoria_idx" ON "productos" USING btree ("categoria_id");--> statement-breakpoint
CREATE VIEW "public"."stock_actual" AS (select producto_id, bodega_id, sum(cantidad) as cantidad from movimientos group by producto_id, bodega_id);
