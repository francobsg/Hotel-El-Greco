import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";

import * as esquema from "@/db/schema";

const entorno_base_datos = z.object({
  DATABASE_URL: z.url({ error: "Configura una DATABASE_URL valida en .env.local." }),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(20).default(10),
});

function crear_base_datos() {
  const { DATABASE_URL, DATABASE_POOL_MAX } = entorno_base_datos.parse(process.env);
  const cliente = postgres(DATABASE_URL, { prepare: false, max: DATABASE_POOL_MAX });
  return drizzle(cliente, { schema: esquema });
}

// App Router puede cargar este modulo en bundles separados de paginas y API.
// Compartir el pool por proceso mantiene DATABASE_POOL_MAX para ambos.
const cache_base_datos = globalThis as typeof globalThis & { hotel_greco_db?: ReturnType<typeof crear_base_datos> };

// Conexion diferida: el scaffolding y el build no necesitan credenciales.
export function obtener_db() {
  cache_base_datos.hotel_greco_db ??= crear_base_datos();
  return cache_base_datos.hotel_greco_db;
}
