"use client";
import Image from "next/image";
import Link from "next/link";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import type { DetalleGuia } from "@/lib/guias/tipos";
import { etiquetas_tipo } from "@/lib/guias/tipos";
import { formato_cantidad, formato_fecha } from "@/lib/stats/formatos";
export function ReciboGuia({ guia, historial = false }: { guia: DetalleGuia; historial?: boolean }) {
  return <Card><section data-guia-imprimible className="space-y-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-sm font-medium text-dorado">Hotel Museo El Greco</p><h2 className="text-2xl">Guía {guia.folio}</h2><p className="mt-1 text-sm">{etiquetas_tipo[guia.tipo]}{guia.provisional ? " · Provisional" : ""} · {formato_fecha(guia.fecha)}</p></div><Button className="no-imprimir" onClick={() => window.print()}><Printer size={18} />Imprimir guía</Button></div>
    <dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-texto-secundario">Origen</dt><dd>{guia.origen ?? "Proveedor / Entrada"}</dd></div><div><dt className="text-texto-secundario">Destino</dt><dd>{guia.destino ?? "Consumo / Salida"}</dd></div><div><dt className="text-texto-secundario">Usuario</dt><dd>{guia.usuario}</dd></div><div><dt className="text-texto-secundario">N° factura</dt><dd>{guia.n_factura ?? "Sin factura"}</dd></div></dl>
    <DataTable titulo="Ítems de la guía" filas={guia.items} clave_fila={(item) => item.id} columnas={[{ clave: "producto", titulo: "Producto", contenido: (item) => item.producto }, { clave: "cantidad", titulo: "Cantidad", contenido: (item) => formato_cantidad(item.cantidad) }, { clave: "unidad", titulo: "Unidad", contenido: (item) => item.unidad }, { clave: "marca", titulo: "Marca", contenido: (item) => item.marca ?? "—" }, { clave: "descripcion", titulo: "Descripción", contenido: (item) => item.descripcion ?? "—" }]} />
    <div><h3 className="text-base">Glosa / Observaciones</h3><p className="mt-2 whitespace-pre-wrap text-sm">{guia.glosa ?? "Sin observaciones."}</p></div>
    {guia.imagen_factura_url && <div className="no-imprimir"><h3 className="mb-3 text-base">Factura adjunta</h3><a href={guia.imagen_factura_url} target="_blank" rel="noreferrer" className="block"><Image unoptimized src={guia.imagen_factura_url} width={1000} height={750} alt={`Factura de la guía ${guia.folio}`} className="max-h-96 w-full rounded-lg border border-verde-900/10 object-contain" /></a></div>}
    <p className="text-xs text-texto-secundario">Las guías se conservan sin edición ni eliminación. Para corregir existencias, superadmin debe registrar un ajuste.</p>
    {historial && <Link className="no-imprimir block text-sm text-verde-700 underline" href="/historial">← Volver al historial</Link>}
  </section></Card>;
}
