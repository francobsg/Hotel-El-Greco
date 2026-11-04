import { FileClock, Upload } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { requirePage } from "@/lib/auth";
import { obtener_dias_provisionales } from "@/lib/caja/servidor";
export default async function VentasDiarias() {
  await requirePage("superadmin", "admin");
  const dias = await obtener_dias_provisionales();
  return <div className="space-y-6"><PageHeader icono={FileClock} titulo="Ventas diarias" subtitulo="Resumen de caja diario pendiente de definición." acciones={<Badge estado="bajo">En desarrollo</Badge>} />
    <Card><div className="rounded-lg border-2 border-dashed border-verde-900/20 bg-crema/60 p-6 text-center"><Upload className="mx-auto mb-3 text-texto-secundario" size={32} aria-hidden /><h2 className="text-lg">Carga del resumen diario</h2><p className="mx-auto my-4 max-w-xl text-sm text-texto-secundario">Próximamente: aquí se subirá el resumen de caja diario para reemplazar los registros provisionales</p><Button disabled>Subir archivo · Próximamente</Button></div></Card>
    <Card><h2 className="mb-3 text-lg">Flujo previsto</h2><p className="text-sm text-texto-secundario">Subir archivo → Previsualizar → Conciliar con lo provisional → Día conciliado.</p><p className="mt-3 text-sm text-texto-secundario">El formato aún está por definir. Por ahora, las ventas de caja son provisionales y todos los días permanecen pendientes.</p></Card>
    <Card className="min-w-0"><h2 className="mb-4 text-lg">Días pendientes</h2><DataTable titulo="Días de ventas provisionales" filas={dias} clave_fila={(d) => d.fecha} columnas={[{ clave: "fecha", titulo: "Fecha", contenido: (d) => d.fecha.split("-").reverse().join("/") }, { clave: "total", titulo: "Total de platos provisionales", contenido: (d) => d.total.toLocaleString("es-CL") }, { clave: "estado", titulo: "Estado", contenido: () => <Badge estado="bajo">Pendiente</Badge> }, { clave: "accion", titulo: "Acción", contenido: () => <Button variante="secundario" disabled>Subir resumen</Button> }]} /></Card>
  </div>;
}
