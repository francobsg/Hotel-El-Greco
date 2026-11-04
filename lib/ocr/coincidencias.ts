import type { ProductoInventario } from "@/lib/inventario/tipos";
import type { DatosFactura } from "./tipos";
function normalizar(texto: string) { return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\b\d+(?:[.,]\d+)?\s*(kg|g|gr|lt|ml|un|caja)?\b/g, " ").replace(/[^a-z]+/g, " ").trim().replace(/\s+/g, " "); }
function similitud(a: string, b: string) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const palabras_a = new Set(a.split(" ")), palabras_b = new Set(b.split(" "));
  const comunes = [...palabras_a].filter((palabra) => palabras_b.has(palabra)).length;
  const tokens = 2 * comunes / (palabras_a.size + palabras_b.size);
  const pares = (texto: string) => new Set(Array.from({ length: Math.max(0, texto.length - 1) }, (_, indice) => texto.slice(indice, indice + 2)));
  const aa = pares(a), bb = pares(b);
  const letras = aa.size + bb.size ? 2 * [...aa].filter((par) => bb.has(par)).length / (aa.size + bb.size) : 0;
  return Math.max(tokens, letras);
}
export function emparejar_items(items: DatosFactura["items"], productos: ProductoInventario[]) {
  return items.map((item) => {
    const nombre = normalizar(item.descripcion);
    const candidatos = productos.filter((producto) => item.unidad !== null && producto.unidad === item.unidad).map((producto) => ({ producto, puntuacion: similitud(nombre, normalizar(producto.nombre)) })).sort((a, b) => b.puntuacion - a.puntuacion || a.producto.id - b.producto.id);
    const mejor = candidatos[0];
    const claro = mejor && mejor.puntuacion >= 0.7 && (!candidatos[1] || mejor.puntuacion - candidatos[1].puntuacion >= 0.1);
    return { ...item, producto: claro ? mejor.producto : null };
  });
}

export function emparejar_platillos(items: DatosFactura["items"], platillos: { id: number; nombre: string }[]) {
  return items.map((item) => {
    const candidatos = platillos.map((platillo) => ({ ...platillo, puntuacion: similitud(normalizar(item.descripcion), normalizar(platillo.nombre)) })).sort((a, b) => b.puntuacion - a.puntuacion || a.id - b.id);
    const mejor = candidatos[0];
    const claro = mejor && mejor.puntuacion >= 0.7 && (!candidatos[1] || mejor.puntuacion - candidatos[1].puntuacion >= 0.1);
    return { descripcion: item.descripcion, platillo_id: claro ? mejor.id : null, cantidad: item.cantidad !== null && Number.isInteger(item.cantidad) && item.cantidad <= 999 ? item.cantidad : null };
  });
}
