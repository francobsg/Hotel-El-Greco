"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { DataTable } from "@/components/ui/DataTable";
import type { FilaConfiguracion, RecursoConfiguracion } from "@/lib/configuracion/servicio";
const etiquetas = { niveles: "Niveles de stock", categorias: "Categorías", platillos: "Platillos", recetas: "Recetas" };
const campo = "mt-2 block min-h-11 w-full min-w-0 rounded-lg border border-verde-900/20 bg-white px-3";
function SelectorCatalogo({ recurso, id, nombre, al_elegir }: { recurso: "producto" | "platillo"; id: number; nombre: string; al_elegir: (id: number) => void }) {
  const [buscar, set_buscar] = useState(""); const [filas, set_filas] = useState<{ id: number; nombre: string }[]>([]); const [error, set_error] = useState("");
  useEffect(() => {
    const control = new AbortController();
    const temporizador = setTimeout(async () => {
      try {
        const url = recurso === "producto" ? `/api/inventario/productos?buscar=${encodeURIComponent(buscar)}` : `/api/configuracion?recurso=platillos&buscar=${encodeURIComponent(buscar)}`;
        const respuesta = await fetch(url, { signal: control.signal }); const datos = await respuesta.json();
        if (!respuesta.ok) throw new Error(datos.error || "No se pudo buscar."); set_filas(datos.filas); set_error("");
      } catch { if (!control.signal.aborted) set_error("No se pudo cargar el catálogo. Reintenta la búsqueda."); }
    }, 200);
    return () => { clearTimeout(temporizador); control.abort(); };
  }, [buscar, recurso]);
  return <div><label className="text-sm">Buscar {recurso}<input value={buscar} onChange={(e) => set_buscar(e.target.value)} className={campo} placeholder="Nombre…" /></label><label className="mt-3 block text-sm">Seleccionar {recurso}<select aria-label={`Seleccionar ${recurso}`} required value={id || ""} onChange={(e) => al_elegir(Number(e.target.value))} className={campo}><option value="">Selecciona…</option>{id > 0 && !filas.some((f) => f.id === id) && <option value={id}>{nombre}</option>}{filas.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}</select></label>{error && <p role="alert" className="text-critico">{error}</p>}</div>;
}
export function Configuracion({ recurso, filas, total, pagina, buscar, puede_editar }: { recurso: RecursoConfiguracion; filas: FilaConfiguracion[]; total: number; pagina: number; buscar: string; puede_editar: boolean }) {
  const router = useRouter(); const [abierto, set_abierto] = useState(false); const [eliminando, set_eliminando] = useState(false); const [actual, set_actual] = useState<FilaConfiguracion | null>(null);
  const [ocupado, set_ocupado] = useState(false); const [error, set_error] = useState(""); const [exito, set_exito] = useState("");
  const [producto_id, set_producto] = useState(0), [platillo_id, set_platillo] = useState(0);
  const paginas = Math.max(1, Math.ceil(total / 50)); const enlace = (n: number) => `/configuracion?${new URLSearchParams({ recurso, pagina: String(n), buscar })}`;
  function abrir(fila: FilaConfiguracion | null, eliminar = false) { set_actual(fila); set_producto(fila?.producto_id ?? 0); set_platillo(fila?.platillo_id ?? 0); set_eliminando(eliminar); set_error(""); set_abierto(true); }
  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault(); set_ocupado(true); set_error("");
    const form = new FormData(evento.currentTarget); const texto = (nombre: string) => String(form.get(nombre) || "").trim();
    const datos = recurso === "niveles" ? { stock_critico: texto("stock_critico"), stock_minimo: texto("stock_minimo"), stock_maximo: texto("stock_maximo") }
      : recurso === "categorias" ? { nombre: texto("nombre"), grupo_grafico: texto("grupo_grafico") || null }
      : recurso === "platillos" ? { nombre: texto("nombre"), precio: texto("precio") || null, activo: form.get("activo") === "on" }
      : { platillo_id, producto_id, gramos_o_ml: texto("gramos_o_ml") };
    try {
      const respuesta = await fetch(`/api/configuracion/${recurso}${actual ? `/${actual.id}` : ""}`, { method: eliminando ? "DELETE" : actual ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, ...(eliminando ? {} : { body: JSON.stringify(datos) }) });
      const r = await respuesta.json(); if (!respuesta.ok) throw new Error(r.error || "No se pudo guardar.");
      set_abierto(false); set_exito(eliminando ? "Registro eliminado." : "Configuración guardada."); router.refresh();
    } catch (error) { set_error(error instanceof Error ? error.message : "No se pudo guardar."); }
    finally { set_ocupado(false); }
  }
  return <div className="space-y-5"><nav aria-label="Apartados de configuración" className="flex flex-wrap gap-2">{Object.entries(etiquetas).map(([clave, titulo]) => <Link key={clave} href={`/configuracion?recurso=${clave}`} aria-current={recurso === clave ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-lg border px-4 text-sm ${recurso === clave ? "border-verde-700 bg-verde-700 text-white" : "border-verde-700 text-verde-700"}`}>{titulo}</Link>)}</nav>
    <Card><div className="mb-5 flex flex-wrap items-end gap-4"><form className="min-w-0 flex-1"><input name="recurso" type="hidden" value={recurso} /><div className="flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm">Buscar en {etiquetas[recurso]}<input name="buscar" defaultValue={buscar} maxLength={150} className={campo} /></label><Button type="submit" variante="secundario">Buscar</Button></div></form>{puede_editar && recurso !== "niveles" && <Button onClick={() => abrir(null)}>Nuevo registro</Button>}</div>
      {!puede_editar && <p className="mb-4 text-sm text-texto-secundario">Tu cuenta tiene acceso de solo lectura.</p>}{exito && <p role="status" className="mb-4 text-verde-700">{exito}</p>}
      <DataTable titulo={etiquetas[recurso]} filas={filas} clave_fila={(f) => f.id} columnas={[{ clave: "nombre", titulo: recurso === "recetas" ? "Platillo" : "Nombre", contenido: (f) => f.nombre }, ...(recurso === "niveles" ? [{ clave: "niveles", titulo: "Crítico / Mínimo / Máximo", contenido: (f: FilaConfiguracion) => `${f.stock_critico} / ${f.stock_minimo} / ${f.stock_maximo} ${f.unidad}` }] : recurso === "categorias" ? [{ clave: "grupo", titulo: "Grupo gráfico", contenido: (f: FilaConfiguracion) => f.grupo_grafico || "Sin grupo" }] : recurso === "platillos" ? [{ clave: "precio", titulo: "Precio", contenido: (f: FilaConfiguracion) => f.precio === null ? "Sin precio" : `$ ${Number(f.precio).toLocaleString("es-CL")}` }, { clave: "activo", titulo: "Estado", contenido: (f: FilaConfiguracion) => f.activo ? "Activo" : "Inactivo" }] : [{ clave: "producto", titulo: "Ingrediente", contenido: (f: FilaConfiguracion) => f.producto }, { clave: "cantidad", titulo: "Gramos / ml", contenido: (f: FilaConfiguracion) => f.gramos_o_ml }]), ...(puede_editar ? [{ clave: "acciones", titulo: "Acciones", contenido: (f: FilaConfiguracion) => <div className="flex gap-2"><Button variante="secundario" onClick={() => abrir(f)}>Editar</Button>{recurso !== "niveles" && <Button variante="peligro" onClick={() => abrir(f, true)}>Eliminar</Button>}</div> }] : [])]} />
      <nav aria-label="Paginación de configuración" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><span>{total} registros · Página {pagina} de {paginas}</span><div className="flex gap-4">{pagina > 1 && <Link className="inline-flex min-h-11 items-center text-verde-700" href={enlace(pagina - 1)}>Anterior</Link>}{pagina < paginas && <Link className="inline-flex min-h-11 items-center text-verde-700" href={enlace(pagina + 1)}>Siguiente</Link>}</div></nav>
    </Card><Modal abierto={abierto} titulo={eliminando ? "Eliminar registro" : actual ? "Editar configuración" : "Nuevo registro"} bloqueado={ocupado} al_cerrar={() => set_abierto(false)}><form key={`${recurso}:${actual?.id ?? "nuevo"}:${eliminando}`} onSubmit={guardar} className="space-y-4">
      {eliminando ? <p>Confirma la eliminación de {actual?.nombre}. Los registros con historial o referencias se conservan.</p> : <>
        {recurso === "niveles" && <><p className="text-sm">{actual?.nombre} · {actual?.unidad}. Solo modifica umbrales; el stock se calcula desde movimientos.</p>{["stock_critico", "stock_minimo", "stock_maximo"].map((n) => <label key={n} className="block text-sm">{n === "stock_critico" ? "Nivel crítico" : n === "stock_minimo" ? "Nivel mínimo" : "Nivel máximo"}<input required name={n} type="number" min="0" step="0.001" defaultValue={actual?.[n as "stock_critico"] ?? "0"} className={campo} /></label>)}</>}
        {(recurso === "categorias" || recurso === "platillos") && <label className="block text-sm">Nombre<input required name="nombre" minLength={2} maxLength={recurso === "categorias" ? 100 : 150} defaultValue={actual?.nombre || ""} className={campo} /></label>}
        {recurso === "categorias" && <><label className="block text-sm">Grupo gráfico<input name="grupo_grafico" list="grupos-grafico" maxLength={100} defaultValue={actual?.grupo_grafico || ""} className={campo} /></label><datalist id="grupos-grafico">{["Carnes", "Pastas y arroz", "Verduras y frutas", "Lácteos y huevos"].map((g) => <option key={g}>{g}</option>)}</datalist><p className="text-xs text-texto-secundario">Los cuatro gráficos del panel usan estos nombres de grupo. Dejar vacío excluye la categoría del panel.</p></>}
        {recurso === "platillos" && <><label className="block text-sm">Precio (opcional)<input name="precio" type="number" min="0" step="0.01" defaultValue={actual?.precio || ""} className={campo} /></label><label className="flex min-h-11 items-center gap-3 text-sm"><input name="activo" type="checkbox" defaultChecked={actual?.activo ?? true} className="h-5 w-5" />Platillo activo</label></>}
        {recurso === "recetas" && <><SelectorCatalogo recurso="platillo" id={platillo_id} nombre={actual?.nombre || "Seleccionado"} al_elegir={set_platillo} /><SelectorCatalogo recurso="producto" id={producto_id} nombre={actual?.producto || "Seleccionado"} al_elegir={set_producto} /><label className="block text-sm">Gramos / ml por porción<input required name="gramos_o_ml" type="number" min="1" step="1" defaultValue={actual?.gramos_o_ml || ""} className={campo} /></label><p className="text-xs text-texto-secundario">Ingredientes en kg usan gramos; en lt usan ml. Productos un/caja requieren definir equivalencia.</p></>}
      </>}{error && <p role="alert" className="text-sm text-critico">{error}</p>}<Button type="submit" variante={eliminando ? "destructivo" : "primario"} disabled={ocupado} className="w-full">{ocupado ? "Guardando…" : eliminando ? "Confirmar eliminación" : "Guardar"}</Button>
    </form></Modal></div>;
}
