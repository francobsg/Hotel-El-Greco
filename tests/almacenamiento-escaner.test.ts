import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { leer_imagen_escaner, subir_imagen_escaner } from "@/lib/escaner/almacenamiento";
const imagen = new Uint8Array([255, 216, 255, 0]);
let directorio: string | undefined;
afterEach(async () => {
  vi.unstubAllEnvs(); vi.unstubAllGlobals();
  if (directorio && dirname(resolve(directorio)) === resolve(tmpdir()) && basename(directorio).startsWith("greco-ocr-")) await rm(directorio, { recursive: true, force: true });
  directorio = undefined;
});
it("almacena JPEG local con UUID, lectura y limpieza; rechaza rutas e imagenes invalidas", async () => {
  directorio = await mkdtemp(join(tmpdir(), "greco-ocr-"));
  vi.stubEnv("SUPABASE_URL", ""); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", ""); vi.stubEnv("ESCANER_UPLOADS_DIR", directorio);
  const archivo = await subir_imagen_escaner(imagen, 1, "http://localhost:3000");
  expect(archivo.imagen_url).toContain("/escaner/imagen/local/1/");
  expect(await leer_imagen_escaner("local", archivo.ruta)).toEqual(imagen);
  await archivo.descartar(); await expect(leer_imagen_escaner("local", archivo.ruta)).rejects.toMatchObject({ estado: 404 });
  await expect(leer_imagen_escaner("local", "../archivo")).rejects.toThrow();
  await expect(subir_imagen_escaner(new Uint8Array([0]), 1, "http://localhost")).rejects.toMatchObject({ estado: 400 });
});
it("usa Storage con credenciales servidor, no expone clave en URL y no sobrescribe", async () => {
  vi.stubEnv("SUPABASE_URL", "https://proyecto.supabase.co"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "clave-servidor-prueba"); vi.stubEnv("SUPABASE_STORAGE_BUCKET", "facturas");
  const solicitar = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ Key: "facturas/prueba.jpg" })); vi.stubGlobal("fetch", solicitar);
  const archivo = await subir_imagen_escaner(imagen, 1, "http://localhost");
  expect(archivo.almacenamiento).toBe("supabase");
  expect(solicitar.mock.calls[0][0]).toMatch(/^https:\/\/proyecto.supabase.co\/storage\/v1\/object\/facturas\/1\//);
  expect(solicitar.mock.calls[0][1]?.headers).toMatchObject({ "x-upsert": "false", Authorization: "Bearer clave-servidor-prueba" });
  expect(archivo.imagen_url).not.toContain("clave-servidor-prueba");
});
it("produccion sin Storage/volumen responde error claro", async () => {
  vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("SUPABASE_URL", ""); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", ""); vi.stubEnv("ESCANER_UPLOADS_DIR", "");
  await expect(subir_imagen_escaner(imagen, 1, "http://localhost")).rejects.toMatchObject({ estado: 503 });
});
