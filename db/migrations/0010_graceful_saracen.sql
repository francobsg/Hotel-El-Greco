UPDATE "productos" SET "activo" = true WHERE "activo" = false;
--> statement-breakpoint
ALTER TABLE "productos" DROP COLUMN "activo";