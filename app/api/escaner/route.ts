import { NextResponse } from "next/server";
import { requireMutation } from "@/lib/auth";
import { respuesta_error, validar_origen } from "@/lib/auth/http";
import { ErrorAcceso } from "@/lib/auth/servicio";
import { obtener_db } from "@/lib/db";
import { subir_imagen_escaner, validar_imagen_jpeg } from "@/lib/escaner/almacenamiento";
import { firmar_escaneo } from "@/lib/escaner/token";
import { obtener_ocr } from "@/lib/ocr";
import { ErrorOcr, factura_ocr } from "@/lib/ocr/tipos";
import { emparejar_items } from "@/lib/ocr/coincidencias";
import { crear_servicio_inventario } from "@/lib/inventario/servicio";
import { leer_filtros_inventario } from "@/lib/inventario/tipos";
export const runtime = "nodejs";
export const maxDuration = 90;
export async function POST(request: Request) {
  let imagen: Awaited<ReturnType<typeof subir_imagen_escaner>> | undefined;
  try {
    validar_origen(request);
    const usuario = await requireMutation("superadmin", "trabajador");
    const archivo = (await request.formData()).get("imagen");
    if (!(archivo instanceof File) || archivo.size > 5 * 1024 * 1024) throw new ErrorAcceso(400, "Selecciona una foto JPEG de hasta 5 MB.");
    const contenido = new Uint8Array(await archivo.arrayBuffer()); validar_imagen_jpeg(contenido);
    imagen = await subir_imagen_escaner(contenido, usuario.id, request.headers.get("origin")!);
    const ocr = obtener_ocr();
    const factura = factura_ocr.parse(await ocr.reconocer(contenido, request.signal));
    if (!factura.items.length) throw new ErrorAcceso(422, "No se detectaron productos. Toma otra foto o registra la guía manualmente.");
    const { filas } = await crear_servicio_inventario(obtener_db()).listar(leer_filtros_inventario({}), true);
    const token = await firmar_escaneo(usuario, imagen);
    return NextResponse.json({ factura, items: emparejar_items(factura.items, filas), token, imagen_url: imagen.imagen_url, demostracion: ocr.demostracion }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (imagen) await imagen.descartar().catch(() => {});
    if (error instanceof ErrorOcr) return NextResponse.json({ error: error.message }, { status: error.estado });
    return respuesta_error(error);
  }
}
