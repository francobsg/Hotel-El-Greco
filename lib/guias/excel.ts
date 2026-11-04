import ExcelJS from "exceljs";
import { etiquetas_tipo, type GuiaListado } from "./tipos";
export async function exportar_guias(guias: GuiaListado[]) {
  const libro = new ExcelJS.Workbook(); libro.creator = "Hotel Museo El Greco";
  const hoja = libro.addWorksheet("Historial", { views: [{ state: "frozen", ySplit: 1 }] });
  hoja.columns = [{ header: "Fecha", key: "fecha", width: 15 }, { header: "Folio", key: "folio", width: 18 }, { header: "Tipo", key: "tipo", width: 24 }, { header: "Origen", key: "origen", width: 26 }, { header: "Destino", key: "destino", width: 26 }, { header: "Ítems", key: "total_items", width: 12 }, { header: "Detalle de ítems", key: "resumen_items", width: 60 }, { header: "Glosa / Observaciones", key: "glosa", width: 40 }, { header: "Usuario", key: "usuario", width: 28 }, { header: "N° factura", key: "n_factura", width: 20 }];
  for (const guia of guias) hoja.addRow({ ...guia, tipo: etiquetas_tipo[guia.tipo] ?? guia.tipo });
  hoja.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  hoja.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF14532D" } };
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: hoja.columnCount } };
  return new Uint8Array(await libro.xlsx.writeBuffer());
}
