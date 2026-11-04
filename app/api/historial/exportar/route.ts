import { respuesta_error } from "@/lib/auth/http";
import { obtener_historial_guias } from "@/lib/guias";
import { leer_filtros_historial } from "@/lib/guias/tipos";
import { exportar_guias } from "@/lib/guias/excel";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try { const { filtros } = leer_filtros_historial(Object.fromEntries(new URL(request.url).searchParams)); const { filas } = await obtener_historial_guias(filtros, true); return new Response(await exportar_guias(filas), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="historial-guias.xlsx"', "Cache-Control": "no-store" } }); }
  catch (error) { return respuesta_error(error); }
}
