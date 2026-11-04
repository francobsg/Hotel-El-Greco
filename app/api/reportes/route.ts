import { requireRole } from "@/lib/auth";
import { respuesta_error } from "@/lib/auth/http";
import { obtener_db } from "@/lib/db";
import { crear_servicio_analisis } from "@/lib/analisis/servicio";
import { periodo_reporte } from "@/lib/analisis/tipos";
import { crear_excel_mensual } from "@/lib/analisis/excel";
export const runtime = "nodejs";
export const maxDuration = 90;
export async function GET(request: Request) {
  try {
    await requireRole("superadmin", "admin");
    const parametros = periodo_reporte.parse(Object.fromEntries(new URL(request.url).searchParams));
    const contenido = await obtener_db().transaction(async (tx) => {
      const servicio = crear_servicio_analisis(tx);
      async function* lotes() { let ultimo = 0; for (;;) { const filas = await servicio.movimientos_mes(parametros, ultimo); if (!filas.length) break; yield filas; ultimo = filas[filas.length - 1].id; } }
      return crear_excel_mensual(parametros.bodega, `${parametros.ano}-${parametros.mes}`, lotes(), await servicio.resumen_mes(parametros));
    }, { isolationLevel: "repeatable read" });
    return new Response(new Uint8Array(contenido), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="movimientos-bodega-${parametros.bodega}-${parametros.ano}-${String(parametros.mes).padStart(2, "0")}.xlsx"`, "Cache-Control": "no-store" } });
  } catch (error) { return respuesta_error(error); }
}
