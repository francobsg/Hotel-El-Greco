import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMutation } from "@/lib/auth";
import { respuesta_error, validar_origen } from "@/lib/auth/http";
import { registrarGuia } from "@/lib/stock";
import { traspaso_rapido } from "@/lib/inventario/tipos";
import { fecha_chile } from "@/lib/stats/tipos";

export async function POST(request: Request) {
  try {
    validar_origen(request);
    await requireMutation("superadmin");
    const { producto_id, cantidad, ...bodegas } = traspaso_rapido.parse(await request.json());
    const guia = await registrarGuia({ tipo: "traspaso", ...bodegas, fecha: fecha_chile(), glosa: "Traspaso rápido desde Inventario", items: [{ producto_id, cantidad }] }, ["superadmin"]);
    return NextResponse.json({ folio: guia.folio }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Stock insuficiente")) return NextResponse.json({ error: "Stock insuficiente en Bodega 1 para este producto. Reduce la cantidad o registra una entrada antes de traspasar." }, { status: 409 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Selecciona un producto y una cantidad positiva con hasta 3 decimales. El traspaso es de Bodega 1 a Bodega 2." }, { status: 400 });
    return respuesta_error(error);
  }
}
