import { requirePage } from "@/lib/auth";
import { obtener_historial_guias } from "@/lib/guias";
import { leer_filtros_historial } from "@/lib/guias/tipos";
import { HistorialGuias } from "@/components/guias/HistorialGuias";
export default async function PaginaHistorial({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePage("superadmin", "admin");
  const { filtros, aviso } = leer_filtros_historial(await searchParams);
  return <HistorialGuias filtros={filtros} datos={await obtener_historial_guias(filtros)} aviso={aviso} />;
}