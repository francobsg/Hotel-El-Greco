import { z } from "zod";
import { fecha_chile } from "@/lib/stats/tipos";
import type { UnidadStock } from "@/lib/stats/tipos";
export const tipos_guia = ["entrada", "traspaso", "consumo", "ajuste_positivo", "ajuste_negativo"] as const;
export const etiquetas_tipo: Record<string, string> = { entrada: "Entrada por compra", traspaso: "Traspaso B1 → B2", consumo: "Salida por consumo", ajuste_positivo: "Ajuste +", ajuste_negativo: "Ajuste −", salida: "Salida", venta: "Venta" };
const cantidad = z.string().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/, "Usa hasta 3 decimales.").refine((valor) => Number(valor) > 0, "La cantidad debe ser mayor a cero.");
export const formulario_guia = z.object({ tipo: z.enum(tipos_guia), fecha: z.iso.date().refine((valor) => valor <= fecha_chile(), "La fecha no puede ser futura."), n_factura: z.string().trim().max(100), glosa: z.string().trim().max(2000), bodega_ajuste: z.union([z.literal(1), z.literal(2)]), items: z.array(z.object({ producto_id: z.number().int().positive().max(2147483647), cantidad, marca: z.string().trim().max(100), descripcion: z.string().trim().max(2000) }).strict()).min(1).max(200) }).strict().refine((guia) => guia.tipo !== "entrada" || !!guia.n_factura, { message: "La compra requiere número de factura.", path: ["n_factura"] });
export type FormularioGuia = z.infer<typeof formulario_guia>;
export type FiltrosHistorial = { folio: string; inicio: string | null; fin: string | null; tipo: string | null; bodega: 1 | 2 | null; pagina: number };
export type GuiaListado = { id: number; folio: string; tipo: string; provisional: boolean; fecha: string; origen: string | null; destino: string | null; glosa: string | null; usuario: string; usuario_id: number; n_factura: string | null; total_items: number; resumen_items: string };
export type DetalleGuia = GuiaListado & { imagen_factura_url: string | null; creado_en: string; items: { id: number; producto_id: number; producto: string; unidad: UnidadStock; cantidad: string; marca: string | null; descripcion: string | null }[] };
export type PaginaGuias = { filas: GuiaListado[]; total: number; pagina: number; paginas: number };
export function leer_filtros_historial(parametros: Record<string, string | string[] | undefined>): { filtros: FiltrosHistorial; aviso: string | null } {
  const esquema = z.object({ folio: z.string().trim().max(100), inicio: z.iso.date().nullable(), fin: z.iso.date().nullable(), tipo: z.enum([...tipos_guia, "salida", "venta"]).nullable(), bodega: z.union([z.literal(1), z.literal(2)]).nullable(), pagina: z.coerce.number().int().positive().max(2147483647) }).refine((datos) => !datos.inicio || !datos.fin || datos.inicio <= datos.fin);
  const resultado = esquema.safeParse({ folio: parametros.folio ?? "", inicio: parametros.inicio || null, fin: parametros.fin || parametros.fecha || fecha_chile(), tipo: !parametros.tipo || parametros.tipo === "todos" ? null : parametros.tipo, bodega: !parametros.bodega || parametros.bodega === "todas" ? null : Number(parametros.bodega), pagina: parametros.pagina ?? 1 });
  return resultado.success ? { filtros: resultado.data, aviso: null } : { filtros: { folio: "", inicio: null, fin: fecha_chile(), tipo: null, bodega: null, pagina: 1 }, aviso: "Revisa los filtros: la fecha inicial no puede superar la final y las fechas deben ser válidas." };
}
export function parametros_historial(filtros: FiltrosHistorial) {
  const parametros = new URLSearchParams({ pagina: String(filtros.pagina) });
  if (filtros.folio) parametros.set("folio", filtros.folio);
  if (filtros.inicio) parametros.set("inicio", filtros.inicio);
  if (filtros.fin) parametros.set("fin", filtros.fin);
  if (filtros.tipo) parametros.set("tipo", filtros.tipo);
  if (filtros.bodega) parametros.set("bodega", String(filtros.bodega));
  return parametros;
}
