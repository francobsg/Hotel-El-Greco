import { z } from "zod";

export const grupos_graficos = ["Carnes", "Pastas y arroz", "Verduras y frutas", "Lácteos y huevos"] as const;
export type UnidadStock = "kg" | "lt" | "un" | "caja";
export type FiltrosPanel = { fecha: string; dias: 7 | 30 | 90; bodega: 1 | 2 | null };
export type ResumenPanel = {
  kpis: { productos: number; alertas: number; movimientos: number; usuarios: number };
  total_alertas: number;
  pagina_alertas: number;
  paginas_alertas: number;
  movimientos: { id: number; producto: string; bodega: string; tipo: string; cantidad: string; unidad: UnidadStock; fecha: string }[];
  alertas: { producto_id: number; bodega_id: number; producto: string; bodega: string; cantidad: string; unidad: UnidadStock; estado: "bajo" | "critico" }[];
};
export type SerieStock = { clave: string; nombre: string; unidad: UnidadStock };
export type GraficoStock = { grupo: string; series: SerieStock[]; datos: Record<string, string | number>[] };
export type FilaHistorico = { grupo: string; categoria_id: number; categoria: string; unidad: UnidadStock; fecha: string; cantidad: string };

export function fecha_chile() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
export function restar_dias(fecha: string, dias: number) {
  const resultado = new Date(`${fecha}T12:00:00Z`);
  resultado.setUTCDate(resultado.getUTCDate() - dias);
  return resultado.toISOString().slice(0, 10);
}
export const filtros_panel = z.object({
  fecha: z.iso.date(),
  dias: z.union([z.literal(7), z.literal(30), z.literal(90)]),
  bodega: z.union([z.literal(1), z.literal(2)]).nullable(),
}).strict();

export function leer_filtros(parametros: Record<string, string | string[] | undefined>) {
  const hoy = fecha_chile();
  const resultado = filtros_panel.safeParse({ fecha: parametros.fecha ?? hoy, dias: Number(parametros.dias ?? 30), bodega: !parametros.bodega || parametros.bodega === "todas" ? null : Number(parametros.bodega) });
  if (!resultado.success || resultado.data.fecha > hoy) return { filtros: { fecha: hoy, dias: 30, bodega: null } as FiltrosPanel, aviso: "Los filtros no son válidos. Se muestra el período predeterminado." };
  return { filtros: resultado.data, aviso: null };
}

export function preparar_graficos(filas: FilaHistorico[]): GraficoStock[] {
  return grupos_graficos.map((grupo) => {
    const series = new Map<string, SerieStock>();
    const fechas = new Map<string, Record<string, string | number>>();
    for (const fila of filas) {
      if (fila.grupo !== grupo) continue;
      const clave = `categoria_${fila.categoria_id}_${fila.unidad}`;
      series.set(clave, { clave, nombre: fila.categoria, unidad: fila.unidad });
      const dato = fechas.get(fila.fecha) ?? { fecha: fila.fecha };
      dato[clave] = Number(fila.cantidad);
      fechas.set(fila.fecha, dato);
    }
    return { grupo, series: [...series.values()], datos: [...fechas.values()].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))) };
  });
}
