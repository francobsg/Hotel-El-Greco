import { z } from "zod";
import { fecha_chile, restar_dias } from "@/lib/stats/tipos";
export const periodo_reporte = z.object({ mes: z.coerce.number().int().min(1).max(12), ano: z.coerce.number().int().min(2000).max(2100), bodega: z.coerce.number().pipe(z.union([z.literal(1), z.literal(2)])) }).strict();
export function limites_mes(ano: number, mes: number) {
  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const fin = new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10);
  return { inicio, fin };
}
export const rango_estadisticas = z.object({ inicio: z.iso.date(), fin: z.iso.date(), bodega: z.union([z.literal(1), z.literal(2)]), unidad: z.enum(["kg", "lt", "un", "caja"]) }).refine((d) => d.inicio <= d.fin && d.fin <= fecha_chile() && d.inicio >= restar_dias(d.fin, 365), "Selecciona hasta un año, sin fechas futuras.");
export function leer_rango(p: Record<string, string | string[] | undefined>) {
  const defecto = { inicio: restar_dias(fecha_chile(), 29), fin: fecha_chile(), bodega: 2 as const, unidad: "kg" as const };
  const r = rango_estadisticas.safeParse({ inicio: p.inicio || defecto.inicio, fin: p.fin || defecto.fin, bodega: Number(p.bodega || 2), unidad: p.unidad || "kg" });
  return { rango: r.success ? r.data : defecto, aviso: r.success ? null : "Revisa el rango y la unidad. Se muestran los últimos 30 días." };
}
export type MovimientoReporte = { id: number; fecha: string; folio: string; tipo: string; producto: string; cantidad: string; unidad: string; n_factura: string | null; marca: string | null; usuario: string; provisional: boolean };
export type ResumenReporte = { id: number; producto: string; unidad: string; inicial: string; entradas: string; salidas: string; final: string };
export type DatosEstadisticas = { categorias: { nombre: string; cantidad: number }[]; usados: { nombre: string; dias: number; cantidad: number }[]; rotacion: { id: number; nombre: string; consumo: number; promedio: number; rotacion: number | null }[]; semanas: { fecha: string; entradas: number; salidas: number }[]; ventas: { nombre: string; cantidad: number }[] };
export type PrediccionProducto = { id: number; nombre: string; unidad: string; stock: number; promedio: number; dias: number | null; reponer: number };
