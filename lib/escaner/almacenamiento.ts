import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import { ErrorAcceso } from "@/lib/auth/servicio";
export const ruta_imagen = z.string().regex(/^[1-9]\d*\/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.jpg$/);
export function validar_imagen_jpeg(contenido: Uint8Array) {
  if (!contenido.length || contenido.length > 5 * 1024 * 1024 || contenido[0] !== 255 || contenido[1] !== 216 || contenido[2] !== 255) throw new ErrorAcceso(400, "Sube una foto JPEG válida de hasta 5 MB.");
}
const directorio_local = () => resolve(/* turbopackIgnore: true */ process.env.ESCANER_UPLOADS_DIR || join(process.cwd(), "public", "uploads"));
function configurar_storage() {
  const url = process.env.SUPABASE_URL?.trim(), clave = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url && !clave) return null;
  const datos = z.object({ url: z.url(), clave: z.string().min(1), bucket: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/) }).safeParse({ url, clave, bucket: process.env.SUPABASE_STORAGE_BUCKET?.trim() || "facturas" });
  if (!datos.success) throw new ErrorAcceso(503, "Configura el almacenamiento de facturas en el servidor.");
  return { ...datos.data, url: datos.data.url.replace(/\/$/, "") };
}
function validar_local() { if (process.env.NODE_ENV === "production" && !process.env.ESCANER_UPLOADS_DIR) throw new ErrorAcceso(503, "Configura Supabase Storage para escanear facturas en producción."); }
async function solicitar_storage(metodo: string, ruta: string, contenido?: Uint8Array) {
  const configuracion = configurar_storage();
  if (!configuracion) throw new ErrorAcceso(503, "El almacenamiento Supabase no está configurado.");
  try {
    const respuesta = await fetch(`${configuracion.url}/storage/v1/object/${metodo === "GET" ? "authenticated/" : ""}${configuracion.bucket}/${ruta}`, { method: metodo, headers: { Authorization: `Bearer ${configuracion.clave}`, apikey: configuracion.clave, "Content-Type": "image/jpeg", "x-upsert": "false" }, ...(contenido ? { body: new Uint8Array(contenido) } : {}), signal: AbortSignal.timeout(20000), cache: "no-store" });
    if (!respuesta.ok) throw new ErrorAcceso(respuesta.status === 404 ? 404 : 502, respuesta.status === 404 ? "Imagen no encontrada." : "No se pudo acceder al almacenamiento de facturas.");
    return respuesta;
  } catch (error) { if (error instanceof ErrorAcceso) throw error; throw new ErrorAcceso(504, "El almacenamiento tardó demasiado. Reintenta."); }
}
export async function subir_imagen_escaner(contenido: Uint8Array, usuario_id: number, origen: string) {
  validar_imagen_jpeg(contenido);
  const ruta = ruta_imagen.parse(`${usuario_id}/${randomUUID()}.jpg`);
  const almacenamiento = configurar_storage() ? "supabase" as const : "local" as const;
  if (almacenamiento === "supabase") await solicitar_storage("POST", ruta, contenido);
  else {
    validar_local();
    const destino = join(/* turbopackIgnore: true */ directorio_local(), ruta);
    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, contenido, { flag: "wx", mode: 0o600 });
  }
  const imagen_url = new URL(`/escaner/imagen/${almacenamiento}/${ruta}`, origen).href;
  return { imagen_url, ruta, almacenamiento, descartar: async () => {
    if (almacenamiento === "supabase") await solicitar_storage("DELETE", ruta);
    else await unlink(join(/* turbopackIgnore: true */ directorio_local(), ruta));
  } };
}
export async function leer_imagen_escaner(almacenamiento: "local" | "supabase", ruta: string) {
  ruta_imagen.parse(ruta);
  if (almacenamiento === "supabase") return new Uint8Array(await (await solicitar_storage("GET", ruta)).arrayBuffer());
  validar_local();
  try { return new Uint8Array(await readFile(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ directorio_local(), ruta))); }
  catch { throw new ErrorAcceso(404, "Imagen no encontrada."); }
}
