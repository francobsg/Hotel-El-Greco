import { fecha_chile } from "@/lib/stats/tipos";
import { factura_ocr, type FacturaOcr } from "./tipos";
export class MockOcr implements FacturaOcr {
  readonly demostracion = true;
  constructor(private contexto: "factura" | "boleta" = "factura") {}
  async reconocer(_imagen: Uint8Array, signal?: AbortSignal) {
    signal?.throwIfAborted();
    if (this.contexto === "boleta") return factura_ocr.parse({ n_factura: "BOLETA-DEMO", fecha: fecha_chile(), proveedor: null, items: [{ descripcion: "Pollo con arroz", cantidad: 2, unidad: "un", marca: null }, { descripcion: "Lomo con papas", cantidad: 1, unidad: "un", marca: null }] });
    return factura_ocr.parse({ n_factura: "DEMO-001", fecha: fecha_chile(), proveedor: "Proveedor de demostración", items: [{ descripcion: "ACEITE VEGETAL", cantidad: 2.5, unidad: "lt", marca: null }, { descripcion: "ARROZ", cantidad: 5, unidad: "kg", marca: null }, { descripcion: "Producto de ejemplo sin coincidencia", cantidad: 1, unidad: "un", marca: null }] });
  }
}
