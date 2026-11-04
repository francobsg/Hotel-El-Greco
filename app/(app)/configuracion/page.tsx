import { Settings } from "lucide-react";
import { z } from "zod";
import { requirePage } from "@/lib/auth";
import { obtener_db } from "@/lib/db";
import { crear_servicio_configuracion, recursos } from "@/lib/configuracion/servicio";
import { PageHeader } from "@/components/ui/PageHeader";
import { Configuracion } from "@/components/configuracion/Configuracion";
export default async function PaginaConfiguracion({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const usuario = await requirePage("superadmin", "admin"); const p = await searchParams;
  const leido = z.object({ recurso: z.enum(recursos), pagina: z.coerce.number().int().min(1).max(100000), buscar: z.string().max(150) }).safeParse({ recurso: p.recurso || "niveles", pagina: p.pagina || 1, buscar: p.buscar || "" });
  const filtro = leido.success ? leido.data : { recurso: "niveles" as const, pagina: 1, buscar: "" };
  const datos = await crear_servicio_configuracion(obtener_db()).listar(filtro.recurso, filtro.pagina, filtro.buscar);
  return <><PageHeader icono={Settings} titulo="Configuración" subtitulo="Niveles, categorías, platillos y recetas. Solo superadmin puede modificar." /><Configuracion key={`${filtro.recurso}:${datos.pagina}:${filtro.buscar}`} recurso={filtro.recurso} filas={datos.filas} total={datos.total} pagina={datos.pagina} buscar={filtro.buscar} puede_editar={usuario.rol === "superadmin"} /></>;
}
