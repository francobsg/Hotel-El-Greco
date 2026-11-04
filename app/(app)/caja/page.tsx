import { Receipt } from "lucide-react";
import { Caja } from "@/components/caja/Caja";
import { PageHeader } from "@/components/ui/PageHeader";
import { requirePage } from "@/lib/auth";
import { obtener_datos_caja } from "@/lib/caja/servidor";

export default async function PaginaCaja() {
  await requirePage("superadmin", "trabajador");
  const datos = await obtener_datos_caja();
  return <><PageHeader icono={Receipt} titulo="Modo caja" subtitulo="Arma una venta, revisa y confirma. Descuento provisional en Bodega 2." /><Caja inicial={datos} /></>;
}
