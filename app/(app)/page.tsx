import { Suspense } from "react";
import { LayoutDashboard } from "lucide-react";
import { CargaPanel } from "@/components/dashboard/CargaPanel";
import { ContenidoPanel } from "@/components/dashboard/ContenidoPanel";
import { FiltrosPanel } from "@/components/dashboard/FiltrosPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { requirePage } from "@/lib/auth";
import { leer_filtros } from "@/lib/stats/tipos";

export default async function PaginaPanel({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const usuario = await requirePage("superadmin", "admin");
  const { filtros, aviso } = leer_filtros(await searchParams);
  return <>
    <PageHeader icono={LayoutDashboard} titulo="Panel de Control" subtitulo="Sistema de Gestión de Inventario" acciones={<FiltrosPanel filtros={filtros} />} />
    {aviso && <p role="alert" className="rounded-lg bg-bajo/10 p-3 text-sm text-bajo">{aviso}</p>}
    <Suspense key={JSON.stringify(filtros)} fallback={<CargaPanel />}><ContenidoPanel filtros={filtros} rol={usuario.rol} /></Suspense>
  </>;
}