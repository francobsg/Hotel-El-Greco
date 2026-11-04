import { notFound } from "next/navigation";
import { requirePage } from "@/lib/auth";
import { ErrorAcceso } from "@/lib/auth/servicio";
import { obtener_guia } from "@/lib/guias";
import { ReciboGuia } from "@/components/guias/ReciboGuia";
export default async function PaginaDetalleGuia({ params }: { params: Promise<{ folio: string }> }) {
  await requirePage("superadmin", "admin");
  const { folio } = await params;
  let guia;
  try { guia = await obtener_guia(folio); }
  catch (error) { if (error instanceof ErrorAcceso && error.estado === 404) notFound(); throw error; }
  return <ReciboGuia guia={guia} historial />;
}
