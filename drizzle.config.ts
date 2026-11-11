import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

loadEnvConfig(process.cwd());

// Generar SQL no necesita conexion. Para migrar se prefiere la URL directa/sesion.
const url_base_datos = process.argv.includes("migrate")
  ? process.env.MIGRATIONS_DATABASE_URL || process.env.DATABASE_URL
  : process.env.DATABASE_URL;
if (process.argv.includes("migrate") && !url_base_datos) {
  throw new Error("Configura MIGRATIONS_DATABASE_URL o DATABASE_URL antes de ejecutar las migraciones.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  ...(url_base_datos ? { dbCredentials: { url: url_base_datos } } : {}),
});
