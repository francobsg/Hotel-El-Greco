"use client";
import Image from "next/image";
import Link from "next/link";
import { Camera, CheckCircle2, ScanLine, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormularioGuia, type InicialGuia } from "@/components/guias/FormularioGuia";
import { comprimir_factura } from "@/lib/escaner/comprimir";
import type { RevisionFactura } from "@/lib/escaner/tipos";
export function EscanerFactura({ superadmin, categorias }: { superadmin: boolean; categorias: { id: number; nombre: string }[] }) {
  const camara = useRef<HTMLInputElement>(null);
  const peticion = useRef<AbortController | null>(null);
  const [foto, set_foto] = useState<File | null>(null);
  const [preview, set_preview] = useState("");
  const [ocupado, set_ocupado] = useState(false);
  const [etapa, set_etapa] = useState("");
  const [error, set_error] = useState("");
  const [revision, set_revision] = useState<RevisionFactura | null>(null);
  const [guardada, set_guardada] = useState(false);
  const [registrando, set_registrando] = useState(false);
  useEffect(() => () => peticion.current?.abort(), []);
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);
  async function seleccionar(evento: ChangeEvent<HTMLInputElement>) {
    const imagen = evento.target.files?.[0]; evento.target.value = "";
    if (!imagen) return;
    set_error(""); set_ocupado(true); set_etapa("Preparando foto…"); set_revision(null); set_guardada(false);
    try { const comprimida = await comprimir_factura(imagen); set_foto(comprimida); set_preview(URL.createObjectURL(comprimida)); }
    catch (error) { set_error(error instanceof Error ? error.message : "No se pudo preparar la imagen."); set_foto(null); set_preview(""); }
    finally { set_ocupado(false); }
  }
  async function analizar() {
    if (!foto) return;
    set_error(""); set_ocupado(true); set_etapa("Leyendo factura…");
    const controlador = new AbortController(); peticion.current = controlador;
    try {
      const formulario = new FormData(); formulario.set("imagen", foto);
      const respuesta = await fetch("/api/escaner", { method: "POST", body: formulario, signal: AbortSignal.any([controlador.signal, AbortSignal.timeout(90000)]) });
      const datos = await respuesta.json(); if (!respuesta.ok) throw new Error(datos.error);
      set_revision(datos);
    } catch (error) { set_error(controlador.signal.aborted ? "Lectura cancelada. Puedes volver a intentarlo." : error instanceof Error && !["AbortError", "TimeoutError"].includes(error.name) ? error.message : "La lectura tardó demasiado. Reintenta o registra la guía manualmente."); }
    finally { peticion.current = null; set_ocupado(false); }
  }
  const inicial: InicialGuia | undefined = revision ? { fecha: revision.factura.fecha ?? "", n_factura: revision.factura.n_factura ?? "", proveedor: revision.factura.proveedor ?? "", items: revision.items.map((item, indice) => ({ clave: indice + 1, producto_id: item.producto?.id ?? 0, producto: item.producto ?? undefined, cantidad: item.cantidad === null ? "" : String(item.cantidad), marca: item.marca ?? "", descripcion: item.descripcion, unidad_ocr: item.unidad, conversion_confirmada: false })) } : undefined;
  return <div className="space-y-6"><input ref={camara} aria-label="Foto para escanear" type="file" accept="image/*" capture="environment" className="hidden" disabled={ocupado || registrando} onChange={seleccionar} />
    {!guardada && <Card className="no-imprimir"><div className="mx-auto max-w-xl space-y-5 text-center"><div className="mx-auto w-fit rounded-full bg-verde-700/10 p-4 text-verde-700"><Camera size={36} /></div><p className="text-sm text-texto-secundario">Fotografía la factura completa, con buena luz. Revisarás sus datos antes de ingresar productos.</p>
      <Button className="min-h-16 w-full text-base" disabled={ocupado || registrando} onClick={() => camara.current?.click()}><Camera size={24} />Escanear factura</Button>
      {foto && preview && <div><Image unoptimized src={preview} width={1600} height={1600} alt="Vista previa de la factura" className="max-h-80 w-full rounded-lg border border-verde-900/10 object-contain" /><p className="mt-2 text-xs text-texto-secundario">Foto preparada · {Math.ceil(foto.size / 1024)} KB</p></div>}
      {foto && !revision && <Button className="w-full" variante="acento" disabled={ocupado} onClick={analizar}><ScanLine size={20} />{ocupado ? "Leyendo…" : "Analizar factura"}</Button>}
      {ocupado && <div><p role="status" className="text-sm">{etapa}</p>{etapa === "Leyendo factura…" && <Button variante="secundario" className="mt-3" onClick={() => peticion.current?.abort()}><X size={16} />Cancelar lectura</Button>}</div>}
      {error && <p role="alert" className="text-sm text-critico">{error}</p>}<Link href="/guias/nueva?tipo=entrada" className="block text-sm text-verde-700 underline">Ingresar factura manualmente</Link>
    </div></Card>}
    {revision && inicial && <>{!guardada && <Card className="no-imprimir"><h2 className="mb-3 flex items-center gap-2 text-xl"><CheckCircle2 size={22} />Revisa y confirma la factura</h2>{revision.demostracion && <p role="status" className="mb-4 rounded-lg bg-dorado/10 p-3 text-sm">Modo demostración: estos datos son de ejemplo y no fueron leídos de tu foto. Corrígelos con la factura real antes de confirmar.</p>}<p className="text-sm text-texto-secundario">Las coincidencias del catálogo son sugerencias. Revisa cada ítem; el stock se modifica al confirmar la entrada.</p></Card>}
      <FormularioGuia key={revision.token} tipo_inicial="entrada" superadmin={superadmin} inicial={inicial} escaneo={{ token: revision.token, categorias }} al_enviando={set_registrando} al_guardada={() => set_guardada(true)} al_reiniciar={() => { set_revision(null); set_guardada(false); set_foto(null); set_preview(""); set_error(""); camara.current?.click(); }} />
    </>}
  </div>;
}
