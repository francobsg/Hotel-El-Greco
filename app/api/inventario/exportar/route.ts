import { respuesta_error } from "@/lib/auth/http";
import { obtener_inventario_maestro } from "@/lib/inventario";
import { exportar_inventario } from "@/lib/inventario/excel";
import { leer_filtros_inventario } from "@/lib/inventario/tipos";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const filtros = leer_filtros_inventario(Object.fromEntries(new URL(request.url).searchParams));
    const { filas } = await obtener_inventario_maestro(filtros, true);
    const archivo = await exportar_inventario(filas, filtros);
    return new Response(archivo, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="inventario-${filtros.bodega ? `bodega-${filtros.bodega}` : "global"}-${filtros.fecha}.xlsx"`, "Cache-Control": "no-store" } });
  } catch (error) { return respuesta_error(error); }
}
