import { ArrowLeftRight } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FormularioGuia } from "@/components/guias/FormularioGuia";
import { requirePage } from "@/lib/auth";
import { tipos_guia } from "@/lib/guias/tipos";
import { obtener_guia } from "@/lib/guias";
import { crear_servicio_inventario } from "@/lib/inventario/servicio";
import { leer_filtros_inventario } from "@/lib/inventario/tipos";
import { obtener_db } from "@/lib/db";
import type { InicialGuia } from "@/components/guias/FormularioGuia";
import { ErrorAcceso } from "@/lib/auth/servicio";
export default async function PaginaNuevaGuia({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const usuario = await requirePage("superadmin", "trabajador");
  const parametros = await searchParams;
  const permitido = tipos_guia.find((tipo) => tipo === parametros.tipo && (usuario.rol === "superadmin" || !tipo.startsWith("ajuste_"))) ?? "entrada";
  let inicial: InicialGuia | undefined;
  let aviso: string | null = null;
  if (permitido === "traspaso" && typeof parametros.desde === "string") {
    try {
      const guia = await obtener_guia(parametros.desde, true);
      if (guia.tipo !== "entrada") throw new ErrorAcceso(400, "Selecciona una guía de entrada para preparar el traspaso.");
      const { filas } = await crear_servicio_inventario(obtener_db()).listar(leer_filtros_inventario({}), true);
      inicial = { items: guia.items.map((item, indice) => ({ clave: indice + 1, producto_id: item.producto_id, producto: filas.find((producto) => producto.id === item.producto_id), cantidad: item.cantidad, marca: item.marca ?? "", descripcion: item.descripcion ?? "" })) };
    } catch (error) { if (!(error instanceof ErrorAcceso)) throw error; aviso = "No se pudo preparar el traspaso desde esa guía. Selecciona los productos manualmente."; }
  }
  return <><div className="no-imprimir"><PageHeader icono={ArrowLeftRight} titulo="Nueva guía" subtitulo="Entradas, consumos y traspasos entre bodegas." /></div>{aviso && <p role="alert" className="text-sm text-bajo">{aviso}</p>}<FormularioGuia key={`${permitido}_${parametros.desde ?? ""}`} tipo_inicial={permitido} superadmin={usuario.rol === "superadmin"} inicial={inicial} /></>;
}
