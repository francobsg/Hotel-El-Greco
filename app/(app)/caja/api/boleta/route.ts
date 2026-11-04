import { NextResponse } from "next/server";
import { requireMutation } from "@/lib/auth";
import { respuesta_error, validar_origen } from "@/lib/auth/http";
import { ErrorAcceso } from "@/lib/auth/servicio";
import { obtener_datos_caja } from "@/lib/caja/servidor";
import { validar_imagen_jpeg } from "@/lib/escaner/almacenamiento";
import { obtener_ocr } from "@/lib/ocr";
import { emparejar_platillos } from "@/lib/ocr/coincidencias";
import { ErrorOcr } from "@/lib/ocr/tipos";
export const runtime = "nodejs";
export const maxDuration = 90;
export async function POST(request: Request) {
  try {
    validar_origen(request);
    await requireMutation("superadmin", "trabajador");
    if (Number(request.headers.get("content-length")) > 6 * 1024 * 1024) throw new ErrorAcceso(413, "La foto supera el tamaño permitido.");
    const formulario = await request.formData();
    const foto = formulario.get("imagen");
    if (!(foto instanceof File) || foto.type !== "image/jpeg" || foto.size > 5 * 1024 * 1024) throw new ErrorAcceso(400, "Selecciona una foto JPEG de hasta 5 MB.");
    const imagen = new Uint8Array(await foto.arrayBuffer());
    validar_imagen_jpeg(imagen);
    const ocr = obtener_ocr("boleta");
    const boleta = await ocr.reconocer(imagen, request.signal);
    const { menu } = await obtener_datos_caja();
    // Solo sugerencias: esta ruta nunca escribe ventas, guias ni movimientos.
    return NextResponse.json({ demostracion: ocr.demostracion, items: emparejar_platillos(boleta.items, menu) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ErrorOcr) return NextResponse.json({ error: error.message }, { status: error.estado });
    return respuesta_error(error);
  }
}
