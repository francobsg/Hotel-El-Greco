import { requirePage } from "@/lib/auth";
import { obtener_categorias, obtener_inventario_maestro } from "@/lib/inventario";
import { leer_filtros_inventario } from "@/lib/inventario/tipos";
import { Inventario } from "@/components/inventario/Inventario";

export default async function PaginaInventario({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const usuario = await requirePage("superadmin", "admin");
  const filtros = leer_filtros_inventario(await searchParams);
  const [datos, categorias] = await Promise.all([obtener_inventario_maestro(filtros), usuario.rol === "superadmin" ? obtener_categorias() : Promise.resolve([])]);
  return <Inventario filtros={filtros} datos={datos} categorias={categorias} puede_editar={usuario.rol === "superadmin"} />;
}