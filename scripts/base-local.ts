import { randomBytes } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createServer } from "node:net";
import { loadEnvConfig } from "@next/env";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { z } from "zod";
import * as esquema from "@/db/schema";
import { poblar_base_datos } from "@/db/seed/poblar";
import { fecha_chile } from "@/lib/stats/tipos";

async function iniciar() {
  if (process.env.NODE_ENV === "production") throw new Error("La base embebida es solo para pruebas locales.");
  // No abrir los archivos de una segunda instancia mientras la base ya esta en uso.
  const comprobacion = createServer();
  await new Promise<void>((resolve, reject) => {
    comprobacion.once("error", reject);
    comprobacion.listen(55432, "127.0.0.1", () => comprobacion.close((error) => error ? reject(error) : resolve()));
  });
  const raiz = process.cwd(), archivo_entorno = join(raiz, ".env.local");
  const existe = await stat(archivo_entorno).then(() => true).catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return false; throw error; });
  if (!existe) {
    const clave = z.string().min(12).max(72).parse(process.env.SEED_PASSWORD || `${randomBytes(18).toString("base64url")}-Aa7!`);
    const conexion = `postgresql://postgres:${randomBytes(24).toString("hex")}@127.0.0.1:55432/postgres`;
    await writeFile(archivo_entorno, `# Configuracion privada de prueba local; no versionar.\nDATABASE_URL=${conexion}\nDATABASE_POOL_MAX=1\nAUTH_SECRET=${randomBytes(48).toString("hex")}\nSEED_PASSWORD=${clave}\nOPENAI_API_KEY=\nSUPABASE_URL=\nSUPABASE_SERVICE_ROLE_KEY=\n`, { flag: "wx", mode: 0o600 });
    console.info("Configuracion local creada con secretos aleatorios; las claves no se imprimen en los logs.");
  }
  loadEnvConfig(raiz, true);
  const entorno = z.object({ DATABASE_URL: z.url(), DATABASE_POOL_MAX: z.coerce.number().pipe(z.literal(1)), AUTH_SECRET: z.string().min(32), SEED_PASSWORD: z.string().min(12).max(72) }).parse(process.env);
  const url = new URL(entorno.DATABASE_URL);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" || url.port !== "55432" || url.pathname !== "/postgres") throw new Error("Este comando solo inicia la base local 127.0.0.1:55432. No modifica una base externa ni su configuracion.");
  await mkdir(join(raiz, ".data"), { recursive: true });
  const cliente = await PGlite.create(join(raiz, ".data", "postgres-local"));
  const db = drizzle(cliente, { schema: esquema });
  let socket: PGLiteSocketServer | undefined;
  try {
    await migrate(db, { migrationsFolder: join(raiz, "db", "migrations") });
    const usuarios = await db.select({ id: esquema.usuarios.id }).from(esquema.usuarios).limit(1);
    if (!usuarios.length) {
      const resumen = await poblar_base_datos(db, entorno.SEED_PASSWORD, fecha_chile());
      console.info("Datos de demostracion creados:", resumen);
      console.info("Superadmin activo: admin@hotelgreco.cl. La clave esta en SEED_PASSWORD de .env.local.");
    }
    socket = new PGLiteSocketServer({ db: cliente, host: "127.0.0.1", port: 55432, maxConnections: 10 });
    await socket.start();
    console.info("Base de prueba lista en 127.0.0.1:55432. Datos persistentes en .data/postgres-local.");
    console.info("Manten esta terminal abierta y ejecuta npm run dev en otra terminal.");
    let cerrando = false;
    const cerrar = async () => {
      if (cerrando) return; cerrando = true;
      await socket?.stop(); await cliente.close(); process.exit(0);
    };
    process.once("SIGINT", () => { void cerrar(); });
    process.once("SIGTERM", () => { void cerrar(); });
  } catch (error) { await socket?.stop(); await cliente.close(); throw error; }
}
iniciar().catch(() => { console.error("No se pudo iniciar la base local. Revisa que el puerto 55432 este libre y .env.local apunte a esa base con DATABASE_POOL_MAX=1. No se modificaron cuentas existentes."); process.exitCode = 1; });
