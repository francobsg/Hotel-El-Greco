import Link from "next/link";
import { BrainCircuit } from "lucide-react";
import { z } from "zod";
import { requirePage } from "@/lib/auth";
import { obtener_db } from "@/lib/db";
import { crear_servicio_analisis } from "@/lib/analisis/servicio";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
export default async function Prediccion({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePage("superadmin", "admin"); const p = await searchParams;
  const leido = z.object({ bodega: z.coerce.number().pipe(z.union([z.literal(1), z.literal(2)])), pagina: z.coerce.number().int().min(1).max(100000), buscar: z.string().max(150) }).safeParse({ bodega: p.bodega || 2, pagina: p.pagina || 1, buscar: p.buscar || "" });
  const filtro = leido.success ? leido.data : { bodega: 2, pagina: 1, buscar: "" };
  let datos = await crear_servicio_analisis(obtener_db()).prediccion(filtro); const paginas = Math.max(1, Math.ceil(datos.total / 50));
  if (filtro.pagina > paginas) { filtro.pagina = paginas; datos = await crear_servicio_analisis(obtener_db()).prediccion(filtro); }
  const formato = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 3 });
  const enlace = (pagina: number) => `/prediccion?${new URLSearchParams({ ...Object.fromEntries(Object.entries(filtro).map(([k, v]) => [k, String(v)])), pagina: String(pagina) })}`;
  return <><PageHeader icono={BrainCircuit} titulo="Predicción de reposición" subtitulo="Estimación por promedio móvil de consumo de los últimos 30 días." acciones={<Badge estado="bajo">Estimación · sin IA externa</Badge>} /><Card><form className="flex flex-wrap items-end gap-4"><label className="text-sm">Bodega<select name="bodega" defaultValue={filtro.bodega} className="mt-2 block min-h-11 rounded-lg border border-verde-900/20 px-3"><option value="1">Bodega 1</option><option value="2">Bodega 2</option></select></label><label className="min-w-0 flex-1 text-sm">Buscar producto<input name="buscar" defaultValue={filtro.buscar} maxLength={150} className="mt-2 block min-h-11 w-full rounded-lg border border-verde-900/20 px-3" /></label><Button type="submit">Buscar</Button></form>{!leido.success && <p role="alert">Filtros inválidos; se muestran los valores predeterminados.</p>}<p className="mt-4 text-sm text-texto-secundario">Consumo de salidas/consumos/ventas dividido por 30, incluyendo días sin consumo. Días restantes = stock / consumo diario. Se sugiere reponer bajo mínimo o con menos de 7 días, hasta una cobertura de 14 días respetando min/max. Sin consumo, los días no son calculables. Revisa la estimación antes de comprar.</p></Card><Card className="min-w-0"><DataTable titulo="Estimación de reposición" filas={datos.filas} clave_fila={(p) => p.id} columnas={[{ clave: "nombre", titulo: "Producto", contenido: (p) => p.nombre }, { clave: "unidad", titulo: "Unidad", contenido: (p) => p.unidad }, { clave: "stock", titulo: "Stock actual", contenido: (p) => formato(p.stock) }, { clave: "promedio", titulo: "Consumo / día", contenido: (p) => formato(p.promedio) }, { clave: "dias", titulo: "Días restantes", contenido: (p) => p.dias === null ? "Sin consumo" : p.dias.toLocaleString("es-CL", { maximumFractionDigits: 1 }) }, { clave: "reponer", titulo: "Reposición sugerida", contenido: (p) => formato(p.reponer) }]} /><nav aria-label="Paginación de predicción" className="mt-4 flex flex-wrap justify-between gap-4 text-sm"><span>{datos.total} productos · Página {filtro.pagina} de {paginas}</span><div className="flex gap-4">{filtro.pagina > 1 && <Link className="inline-flex min-h-11 items-center text-verde-700" href={enlace(filtro.pagina - 1)}>Anterior</Link>}{filtro.pagina < paginas && <Link className="inline-flex min-h-11 items-center text-verde-700" href={enlace(filtro.pagina + 1)}>Siguiente</Link>}</div></nav></Card></>;
}
