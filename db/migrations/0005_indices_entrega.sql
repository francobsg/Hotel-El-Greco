CREATE INDEX "guias_usuario_idx" ON "guias" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "guias_imagen_factura_idx" ON "guias" USING btree ("imagen_factura_url");--> statement-breakpoint
CREATE INDEX "recetas_producto_idx" ON "recetas" USING btree ("producto_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_email_normalizado_idx" ON "usuarios" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "ventas_diarias_items_platillo_idx" ON "ventas_diarias_items" USING btree ("platillo_id");--> statement-breakpoint
CREATE INDEX "ventas_temporales_platillo_idx" ON "ventas_temporales" USING btree ("platillo_id");