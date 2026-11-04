import { ScanLine } from "lucide-react";
import { EscanerFactura } from "@/components/escaner/EscanerFactura";
import { PageHeader } from "@/components/ui/PageHeader";
import { requirePage } from "@/lib/auth";
import { crear_servicio_inventario } from "@/lib/inventario/servicio";
import { obtener_db } from "@/lib/db";

export default async function PaginaEscaner() {
  const usuario = await requirePage("superadmin", "trabajador");
  const categorias = await crear_servicio_inventario(obtener_db()).categorias();
  return <><div className="no-imprimir"><PageHeader icono={ScanLine} titulo="Escanear factura" subtitulo="Fotografía, revisa y confirma la entrada a Bodega 1." /></div><EscanerFactura superadmin={usuario.rol === "superadmin"} categorias={categorias} /></>;
}
