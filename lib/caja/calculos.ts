import { ErrorAcceso } from "@/lib/auth/servicio";
import { convertir_receta_a_unidad } from "@/lib/stock/servicio";

export type IngredienteReceta = { platillo_id: number; producto_id: number; gramos_o_ml: string; unidad: "kg" | "lt" | "un" | "caja"; nombre: string };
export function agrupar_platillos(items: { platillo_id: number; cantidad: number }[]) {
  const cantidades = new Map<number, number>();
  for (const item of items) {
    const cantidad = (cantidades.get(item.platillo_id) ?? 0) + item.cantidad;
    if (cantidad > 999) throw new ErrorAcceso(422, "El máximo por platillo es 999 unidades.");
    cantidades.set(item.platillo_id, cantidad);
  }
  return [...cantidades].sort(([a], [b]) => a - b).map(([platillo_id, cantidad]) => ({ platillo_id, cantidad }));
}
export function calcular_ingredientes(items: { platillo_id: number; cantidad: number }[], recetas: IngredienteReceta[]) {
  const totales = new Map<number, { receta: IngredienteReceta; milesimas: bigint }>();
  for (const item of items) {
    const ingredientes = recetas.filter((receta) => receta.platillo_id === item.platillo_id);
    if (!ingredientes.length) throw new ErrorAcceso(422, "Hay un platillo sin receta. Solicita su configuración antes de venderlo.");
    for (const receta of ingredientes) {
      const [entero, decimal = ""] = receta.gramos_o_ml.split(".");
      const valor = (BigInt(entero) * BigInt(1000) + BigInt(decimal.padEnd(3, "0"))) * BigInt(item.cantidad);
      const previo = totales.get(receta.producto_id)?.milesimas ?? BigInt(0);
      totales.set(receta.producto_id, { receta, milesimas: previo + valor });
    }
  }
  return [...totales].sort(([a], [b]) => a - b).map(([producto_id, { receta, milesimas }]) => {
    try {
      const gramos = `${milesimas / BigInt(1000)}.${String(milesimas % BigInt(1000)).padStart(3, "0")}`;
      const cantidad = convertir_receta_a_unidad(gramos, receta.unidad);
      if (Number(cantidad) <= 0) throw new Error("Cantidad no representable");
      return { producto_id, cantidad };
    } catch {
      throw new ErrorAcceso(422, `Revisa la receta de ${receta.nombre}: usa kg/lt y cantidades representables con 3 decimales; un/caja requieren una equivalencia definida.`);
    }
  });
}
