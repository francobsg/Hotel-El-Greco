ALTER TABLE "bodegas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "categorias" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "guia_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "guias" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "movimientos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "platillos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "productos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "recetas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "usuarios" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ventas_diarias" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ventas_diarias_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ventas_temporales" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER VIEW "public"."stock_actual" SET (security_invoker = true);
--> statement-breakpoint
-- La app usa conexion PostgreSQL solo en servidor, sin acceso Data API para los roles del navegador.
DO $$
DECLARE tabla text; rol text;
BEGIN
  FOREACH tabla IN ARRAY ARRAY['usuarios', 'bodegas', 'categorias', 'productos', 'guias', 'guia_items', 'movimientos', 'platillos', 'recetas', 'ventas_diarias', 'ventas_diarias_items', 'ventas_temporales', 'stock_actual'] LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', tabla);
    FOREACH rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = rol) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', tabla, rol);
      END IF;
    END LOOP;
  END LOOP;
END $$;
