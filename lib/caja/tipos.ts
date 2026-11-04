import { z } from "zod";

export const entrada_venta = z.object({
  clave: z.uuid(),
  confirmada: z.literal(true),
  items: z.array(z.object({ platillo_id: z.number().int().positive().max(2147483647), cantidad: z.number().int().min(1).max(999) }).strict()).min(1).max(100),
}).strict();
export type EntradaVenta = z.input<typeof entrada_venta>;
export type PlatilloMenu = { id: number; nombre: string; precio: string | null; disponible: number; error_receta: string | null };
export type ResumenDia = {
  fecha: string;
  platos: { platillo_id: number; nombre: string; cantidad: number }[];
  ingredientes: { producto_id: number; nombre: string; unidad: string; cantidad: string }[];
  registros: { id: number; nombre: string; cantidad: number; hora: string; usuario: string; folio: string }[];
  alertas: { producto_id: number; nombre: string; unidad: string; cantidad: string; estado: "bajo" | "critico" }[];
};
export type DatosCaja = { menu: PlatilloMenu[]; resumen: ResumenDia };
export type DiaProvisional = { fecha: string; total: number };
