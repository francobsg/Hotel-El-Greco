import { z } from "zod";
export const factura_ocr = z.object({
  n_factura: z.string().max(100).nullable(),
  fecha: z.iso.date().nullable(),
  proveedor: z.string().max(150).nullable(),
  items: z.array(z.object({ descripcion: z.string().min(1).max(2000), cantidad: z.number().finite().positive().max(999999999.999).nullable(), unidad: z.enum(["kg", "lt", "un", "caja"]).nullable(), marca: z.string().max(100).nullable() }).strict()).max(200),
}).strict();
export type DatosFactura = z.infer<typeof factura_ocr>;
export interface FacturaOcr {
  readonly demostracion: boolean;
  reconocer(imagen: Uint8Array, signal?: AbortSignal): Promise<DatosFactura>;
}
export class ErrorOcr extends Error {
  constructor(public estado: number, mensaje: string) { super(mensaje); }
}
