import type { DatosFactura } from "@/lib/ocr/tipos";
import type { ProductoInventario } from "@/lib/inventario/tipos";
export type RevisionFactura = { factura: DatosFactura; items: (DatosFactura["items"][number] & { producto: ProductoInventario | null })[]; token: string; imagen_url: string; demostracion: boolean };
