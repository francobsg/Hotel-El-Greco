import { z } from "zod";
import { leer_filtros, type UnidadStock } from "@/lib/stats/tipos";

export type FiltrosInventario = { fecha: string; bodega: 1 | 2 | null; buscar: string; registros: 10 | 25 | 50 | 100; pagina: number; alertas: boolean };
export type ProductoInventario = { id: number; nombre: string; categoria_id: number; categoria: string; unidad: UnidadStock; marca: string | null; stock_critico: string; stock_minimo: string; stock_maximo: string; costo: string; stock_1: string; stock_2: string };
export type PaginaInventario = { filas: ProductoInventario[]; total: number; paginas: number; pagina: number };
export type DetalleProducto = { producto: ProductoInventario; movimientos: { id: number; folio: string; tipo: string; bodega: string; cantidad: string; fecha: string }[] };
export function leer_filtros_inventario(parametros: Record<string, string | string[] | undefined>): FiltrosInventario {
  const { filtros } = leer_filtros({ fecha: parametros.fecha, bodega: parametros.bodega });
  const registros = Number(parametros.registros ?? 25);
  const pagina = Number(parametros.pagina ?? 1);
  return { fecha: filtros.fecha, bodega: filtros.bodega, buscar: typeof parametros.buscar === "string" ? parametros.buscar.trim().slice(0, 150) : "", registros: ([10, 25, 50, 100].includes(registros) ? registros : 25) as FiltrosInventario["registros"], pagina: Number.isSafeInteger(pagina) && pagina > 0 ? Math.min(pagina, 2147483647) : 1, alertas: parametros.estado === "alerta" };
}
export function parametros_inventario(filtros: FiltrosInventario) {
  const parametros = new URLSearchParams({ bodega: String(filtros.bodega ?? "todas"), fecha: filtros.fecha, registros: String(filtros.registros), pagina: String(filtros.pagina) });
  if (filtros.buscar) parametros.set("buscar", filtros.buscar);
  if (filtros.alertas) parametros.set("estado", "alerta");
  return parametros;
}
export function estado_stock(cantidad: string, producto: Pick<ProductoInventario, "stock_critico" | "stock_minimo">): "normal" | "bajo" | "critico" {
  return Number(cantidad) < Number(producto.stock_critico) ? "critico" : Number(cantidad) < Number(producto.stock_minimo) ? "bajo" : "normal";
}
const decimal = (decimales: number, enteros: number) => z.string().regex(new RegExp(`^(?:0|[1-9]\\d{0,${enteros - 1}})(?:\\.\\d{1,${decimales}})?$`), `Usa un valor no negativo con hasta ${decimales} decimales.`);
export const nuevo_producto = z.object({ nombre: z.string().trim().min(2).max(150), categoria_id: z.number().int().positive().max(2147483647), unidad: z.enum(["kg", "lt", "un", "caja"]), marca: z.string().trim().max(100).transform((valor) => valor || null), stock_critico: decimal(3, 9), stock_minimo: decimal(3, 9), stock_maximo: decimal(3, 9), costo: decimal(2, 10) }).strict().refine((datos) => Number(datos.stock_critico) <= Number(datos.stock_minimo) && Number(datos.stock_minimo) <= Number(datos.stock_maximo), { message: "Los niveles deben cumplir Crítico ≤ Mínimo ≤ Máximo.", path: ["stock_minimo"] });
export const traspaso_rapido = z.object({ bodega_origen_id: z.literal(1), bodega_destino_id: z.literal(2), producto_id: z.number().int().positive().max(2147483647), cantidad: decimal(3, 9).refine((valor) => Number(valor) > 0, "La cantidad debe ser mayor a cero.") }).strict();
