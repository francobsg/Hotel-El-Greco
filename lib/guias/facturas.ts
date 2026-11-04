import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ErrorAcceso } from "@/lib/auth/servicio";
import { subir_imagen_escaner } from "@/lib/escaner/almacenamiento";
// Archivos de usuarios creados en runtime; no pertenecen al bundle desplegable.
const directorio = () => resolve(/* turbopackIgnore: true */ process.env.FACTURAS_DIR || join(process.cwd(), ".data", "facturas"));
export async function guardar_factura(archivo: File, origen: string, usuario_id: number) {
  if (archivo.size > 5 * 1024 * 1024) throw new ErrorAcceso(400, "La foto no puede superar 5 MB.");
  const contenido = Buffer.from(await archivo.arrayBuffer());
  const extension = contenido.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ? "jpg" : contenido.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "png" : contenido.subarray(0, 4).toString() === "RIFF" && contenido.subarray(8, 12).toString() === "WEBP" ? "webp" : null;
  if (!extension) throw new ErrorAcceso(400, "Adjunta una foto JPG, PNG o WebP válida.");
  if (process.env.SUPABASE_URL || process.env.SUPABASE_SERVICE_ROLE_KEY) {
    if (extension !== "jpg") throw new ErrorAcceso(400, "La foto debe prepararse como JPEG antes de subir a Supabase.");
    const subida = await subir_imagen_escaner(contenido, usuario_id, origen);
    return { url: subida.imagen_url, descartar: subida.descartar };
  }
  if (process.env.NODE_ENV === "production" && !process.env.FACTURAS_DIR) throw new ErrorAcceso(503, "Configura Supabase Storage o un directorio persistente para adjuntar facturas.");
  await mkdir(directorio(), { recursive: true });
  const nombre = `${randomUUID()}.${extension}`;
  const ruta = join(/* turbopackIgnore: true */ directorio(), nombre);
  await writeFile(ruta, contenido, { flag: "wx", mode: 0o600 });
  return { url: new URL(`/guias/nueva/api/facturas/${nombre}`, origen).href, descartar: () => unlink(ruta) };
}
export async function leer_factura(nombre: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(jpg|png|webp)$/.test(nombre)) throw new ErrorAcceso(404, "Factura no encontrada.");
  try { return { contenido: new Uint8Array(await readFile(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ directorio(), nombre))), tipo: nombre.endsWith(".jpg") ? "image/jpeg" : nombre.endsWith(".png") ? "image/png" : "image/webp" }; }
  catch { throw new ErrorAcceso(404, "Factura no encontrada."); }
}
