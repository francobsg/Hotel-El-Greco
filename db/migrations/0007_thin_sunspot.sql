CREATE TABLE "estado_alertas_stock" (
	"producto_id" integer NOT NULL,
	"bodega_id" integer NOT NULL,
	"ignorada_hasta" timestamp with time zone,
	"resuelta" boolean DEFAULT false NOT NULL,
	CONSTRAINT "estado_alertas_stock_producto_id_bodega_id_pk" PRIMARY KEY("producto_id","bodega_id")
);
--> statement-breakpoint
ALTER TABLE "estado_alertas_stock" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$
DECLARE rol text;
BEGIN
  REVOKE ALL ON TABLE public.estado_alertas_stock FROM PUBLIC;
  FOREACH rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = rol) THEN
      EXECUTE format('REVOKE ALL ON TABLE public.estado_alertas_stock FROM %I', rol);
    END IF;
  END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "estado_alertas_stock" ADD CONSTRAINT "estado_alertas_stock_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estado_alertas_stock" ADD CONSTRAINT "estado_alertas_stock_bodega_id_bodegas_id_fk" FOREIGN KEY ("bodega_id") REFERENCES "public"."bodegas"("id") ON DELETE cascade ON UPDATE no action;