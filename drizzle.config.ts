import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

loadEnvConfig(process.cwd());

// Generar SQL no necesita conexion; migrar si requiere DATABASE_URL.
const url_base_datos = process.env.DATABASE_URL;
if (process.argv.includes("migrate") && !url_base_datos) {
  throw new Error("Configura DATABASE_URL en .env.local antes de migrar.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  ...(url_base_datos ? { dbCredentials: { url: url_base_datos } } : {}),
});
