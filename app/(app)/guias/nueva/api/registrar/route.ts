import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMutation } from "@/lib/auth";
import { respuesta_error, validar_origen } from "@/lib/auth/http";
import { ErrorAcceso } from "@/lib/auth/servicio";
import { formulario_guia } from "@/lib/guias/tipos";
import { guardar_factura } from "@/lib/guias/facturas";
import { registrarGuia } from "@/lib/stock";
import { obtener_guia } from "@/lib/guias";
import { validar_escaneo } from "@/lib/escaner/token";
export const runtime = "nodejs";
export async function POST(request: Request) {
  let factura: Awaited<ReturnType<typeof guardar_factura>> | undefined;
  let guardada = false;
  try {
    validar_origen(request);
    const usuario = await requireMutation("superadmin", "trabajador");
    const formulario = await request.formData();
    const datos = formulario_guia.parse(JSON.parse(String(formulario.get("datos"))));
    const token = formulario.get("escaneo");
    const escaneo = typeof token === "string" && token ? await validar_escaneo(z.string().max(4096).parse(token), usuario) : null;
    if (escaneo && (formulario.get("confirmado") !== "si" || datos.tipo !== "entrada")) throw new ErrorAcceso(400, "Revisa y confirma la factura antes de guardar la entrada.");
    if (datos.tipo.startsWith("ajuste_") && usuario.rol !== "superadmin") throw new ErrorAcceso(403, "Solo superadmin puede registrar ajustes.");
    const imagen = formulario.get("factura");
    if (!escaneo && imagen instanceof File && imagen.size) factura = await guardar_factura(imagen, request.headers.get("origin")!, usuario.id);
    const origen = datos.tipo === "traspaso" ? 1 : datos.tipo === "consumo" ? 2 : datos.tipo === "ajuste_negativo" ? datos.bodega_ajuste : undefined;
    const destino = datos.tipo === "entrada" ? 1 : datos.tipo === "traspaso" ? 2 : datos.tipo === "ajuste_positivo" ? datos.bodega_ajuste : undefined;
    const guia = await registrarGuia({ tipo: datos.tipo, fecha: datos.fecha, bodega_origen_id: origen, bodega_destino_id: destino, n_factura: datos.n_factura || undefined, glosa: datos.glosa || undefined, imagen_factura_url: escaneo?.imagen_url ?? factura?.url, items: datos.items.map((item) => ({ ...item, marca: item.marca || undefined, descripcion: item.descripcion || undefined })) }, ["superadmin", "trabajador"], { factura_unica: !!escaneo });
    guardada = true;
    const detalle = await obtener_guia(guia.folio, true).catch(() => null);
    return NextResponse.json({ folio: guia.folio, guia: detalle }, { status: 201 });
  } catch (error) {
    if (!guardada && factura) await factura.descartar().catch(() => {});
    if (error instanceof Error && error.message.startsWith("Stock insuficiente")) return NextResponse.json({ error: "Stock insuficiente en la bodega de origen. Actualiza el stock disponible y reduce la cantidad." }, { status: 409 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    return respuesta_error(error);
  }
}
