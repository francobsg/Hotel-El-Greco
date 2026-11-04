import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";

import * as esquema from "@/db/schema";
import { poblar_base_datos } from "@/db/seed/poblar";

loadEnvConfig(process.cwd());

async function ejecutar_seed() {
  const entorno = z.object({ DATABASE_URL: z.url(), SEED_PASSWORD: z.string().min(12).max(72) }).parse(process.env);
  const cliente = postgres(entorno.DATABASE_URL, { prepare: false, max: 1 });
  try {
    const fecha_corte = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const resumen = await poblar_base_datos(drizzle(cliente, { schema: esquema }), entorno.SEED_PASSWORD, fecha_corte);
    console.info("Seed completado:", resumen);
  } finally {
    await cliente.end();
  }
}

ejecutar_seed().catch((error: unknown) => {
  // No imprimir el error del driver: podria incluir la conexion o password_hash.
  console.error(error instanceof z.ZodError ? "Configura DATABASE_URL y SEED_PASSWORD (12 a 72 caracteres) en .env.local." : "No se pudo completar el seed. Comprueba migraciones, conexion y que la base este vacia.");
  process.exitCode = 1;
});
