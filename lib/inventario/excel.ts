import ExcelJS from "exceljs";
import { estado_stock, type FiltrosInventario, type ProductoInventario } from "./tipos";

export async function exportar_inventario(filas: ProductoInventario[], filtros: FiltrosInventario) {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Hotel Museo El Greco";
  const hoja = libro.addWorksheet("Inventario", { views: [{ state: "frozen", ySplit: 1 }] });
  const bodegas = filtros.bodega ? [filtros.bodega] : [1, 2];
  hoja.columns = [
    { header: "Producto", key: "nombre", width: 32 }, { header: "Categoría", key: "categoria", width: 24 }, { header: "Marca", key: "marca", width: 20 }, { header: "Unidad", key: "unidad", width: 12 },
    ...bodegas.flatMap((bodega) => [{ header: `Stock Bodega ${bodega}`, key: `stock_${bodega}`, width: 20 }, { header: `Estado Bodega ${bodega}`, key: `estado_${bodega}`, width: 20 }]),
    { header: "Crítico", key: "stock_critico", width: 14 }, { header: "Mínimo", key: "stock_minimo", width: 14 }, { header: "Máximo", key: "stock_maximo", width: 14 }, { header: "Costo (CLP)", key: "costo", width: 18 }, { header: "Fecha de corte", key: "fecha", width: 18 },
  ];
  for (const producto of filas) {
    const fila = hoja.addRow({ ...producto, stock_1: Number(producto.stock_1), stock_2: Number(producto.stock_2), stock_critico: Number(producto.stock_critico), stock_minimo: Number(producto.stock_minimo), stock_maximo: Number(producto.stock_maximo), costo: Number(producto.costo), estado_1: estado_stock(producto.stock_1, producto), estado_2: estado_stock(producto.stock_2, producto), fecha: filtros.fecha });
    for (const clave of ["stock_1", "stock_2", "stock_critico", "stock_minimo", "stock_maximo"]) if (hoja.columns.some((columna) => columna.key === clave)) fila.getCell(clave).numFmt = "#,##0.###";
    fila.getCell("costo").numFmt = '"$" #,##0.00';
  }
  hoja.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  hoja.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF14532D" } };
  hoja.getRow(1).height = 28;
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: hoja.columnCount } };
  return new Uint8Array(await libro.xlsx.writeBuffer());
}
