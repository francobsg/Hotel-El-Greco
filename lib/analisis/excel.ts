import ExcelJS from "exceljs";
import { etiquetas_tipo } from "@/lib/guias/tipos";
import type { MovimientoReporte, ResumenReporte } from "./tipos";
export async function crear_excel_mensual(bodega: number, periodo: string, movimientos: AsyncIterable<MovimientoReporte[]>, resumen: ResumenReporte[]) {
  const libro = new ExcelJS.Workbook(); libro.creator = "Hotel Museo El Greco"; libro.subject = `Bodega ${bodega} · ${periodo}`;
  const hoja = libro.addWorksheet("Movimientos");
  hoja.columns = [{ header: "Fecha", key: "fecha", width: 14 }, { header: "Folio", key: "folio", width: 16 }, { header: "Tipo", key: "tipo", width: 28 }, { header: "Producto", key: "producto", width: 32 }, { header: "Cantidad", key: "cantidad", width: 16 }, { header: "Unidad", key: "unidad", width: 12 }, { header: "N° factura", key: "n_factura", width: 20 }, { header: "Marca", key: "marca", width: 22 }, { header: "Usuario", key: "usuario", width: 28 }];
  for await (const lote of movimientos) for (const m of lote) hoja.addRow({ ...m, tipo: `${etiquetas_tipo[m.tipo] ?? m.tipo}${m.provisional ? " · Provisional" : ""}`, cantidad: Number(m.cantidad) });
  const totales = libro.addWorksheet("Resumen");
  totales.columns = [{ header: "Producto", key: "producto", width: 32 }, { header: "Unidad", key: "unidad", width: 12 }, { header: "Stock inicial", key: "inicial", width: 18 }, { header: "Entradas", key: "entradas", width: 18 }, { header: "Salidas", key: "salidas", width: 18 }, { header: "Stock final", key: "final", width: 18 }];
  for (const r of resumen) totales.addRow({ ...r, inicial: Number(r.inicial), entradas: Number(r.entradas), salidas: Number(r.salidas), final: Number(r.final) });
  for (const h of [hoja, totales]) {
    h.views = [{ state: "frozen", ySplit: 1 }]; h.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, h.rowCount), column: h.columnCount } };
    h.getRow(1).height = 26; h.getRow(1).eachCell((c) => { c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF14532D" } }; c.alignment = { vertical: "middle", wrapText: true }; });
  }
  hoja.getColumn("cantidad").numFmt = "0.000";
  for (const clave of ["inicial", "entradas", "salidas", "final"]) totales.getColumn(clave).numFmt = "0.000";
  return libro.xlsx.writeBuffer();
}
