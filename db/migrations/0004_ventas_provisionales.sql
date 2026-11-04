CREATE TABLE "ventas_temporales" (
	"id" serial PRIMARY KEY NOT NULL,
	"guia_id" integer NOT NULL,
	"platillo_id" integer NOT NULL,
	"cantidad" integer NOT NULL,
	"fecha" date NOT NULL,
	"hora" timestamp with time zone DEFAULT now() NOT NULL,
	"usuario_id" integer NOT NULL,
	CONSTRAINT "ventas_temporales_guia_platillo" UNIQUE("guia_id","platillo_id"),
	CONSTRAINT "ventas_temporales_cantidad_positiva" CHECK ("ventas_temporales"."cantidad" > 0)
);
--> statement-breakpoint
ALTER TABLE "guias" ADD COLUMN "provisional" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "guias" ADD COLUMN "clave_venta" uuid;--> statement-breakpoint
ALTER TABLE "ventas_temporales" ADD CONSTRAINT "ventas_temporales_guia_id_guias_id_fk" FOREIGN KEY ("guia_id") REFERENCES "public"."guias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas_temporales" ADD CONSTRAINT "ventas_temporales_platillo_id_platillos_id_fk" FOREIGN KEY ("platillo_id") REFERENCES "public"."platillos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas_temporales" ADD CONSTRAINT "ventas_temporales_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ventas_temporales_fecha_idx" ON "ventas_temporales" USING btree ("fecha");--> statement-breakpoint
ALTER TABLE "guias" ADD CONSTRAINT "guias_clave_venta_unique" UNIQUE("clave_venta");--> statement-breakpoint
ALTER TABLE "guias" ADD CONSTRAINT "guias_provisional_venta" CHECK (not "guias"."provisional" or "guias"."tipo" = 'venta');--> statement-breakpoint
ALTER TABLE "guias" ADD CONSTRAINT "guias_clave_venta_provisional" CHECK ("guias"."clave_venta" is null or ("guias"."tipo" = 'venta' and "guias"."provisional"));