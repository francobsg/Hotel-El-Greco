import type { ProductoInventario } from "@/lib/inventario/tipos";
import type { FormularioGuia } from "./tipos";
import { formato_cantidad } from "@/lib/stats/formatos";

function milesimas(valor: string) {
  const [entero, decimal = ""] = valor.split(".");
  const signo = entero.startsWith("-") ? BigInt(-1) : BigInt(1);
  return signo * (BigInt(entero.replace("-", "")) * BigInt(1000) + BigInt(decimal.padEnd(3, "0")));
}
// La validacion visible usa la misma unidad del catalogo y suma items repetidos.
// El servidor siempre vuelve a validar el saldo dentro de registrarGuia.
export function validar_stock_formulario(guia: FormularioGuia, productos: ProductoInventario[]): string | null {
  const origen = guia.tipo === "traspaso" ? 1 : guia.tipo === "consumo" ? 2 : guia.tipo === "ajuste_negativo" ? guia.bodega_ajuste : null;
  if (!origen) return null;
  const totales = new Map<number, bigint>();
  for (const item of guia.items) totales.set(item.producto_id, (totales.get(item.producto_id) ?? BigInt(0)) + milesimas(item.cantidad));
  for (const [id, cantidad] of totales) {
    const producto = productos.find((producto) => producto.id === id);
    if (!producto) return "Selecciona un producto válido en cada ítem.";
    const saldo = producto[`stock_${origen}`];
    if (milesimas(saldo) < cantidad) return `Stock insuficiente: ${producto.nombre} tiene ${formato_cantidad(saldo)} ${producto.unidad} disponibles en Bodega ${origen}.`;
  }
  return null;
}
