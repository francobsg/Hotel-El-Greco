"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { GraficoStock as DatosGrafico } from "@/lib/stats/tipos";
import { formato_cantidad, formato_fecha } from "@/lib/stats/formatos";

const colores = ["#14532D", "#B8892B", "#2563EB", "#DC2626", "#6B7A72", "#D97706"];
export function GraficoStock({ grafico }: { grafico: DatosGrafico }) {
  const unidades = [...new Set(grafico.series.map((serie) => serie.unidad))];
  return <div className="min-w-0" role="region" aria-label={`Stock de Bodega 2: ${grafico.grupo}`}>
    <div className="h-72 w-full min-w-0 sm:h-80"><ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart data={grafico.datos} margin={{ top: 10, right: 4, left: -12, bottom: 8 }} accessibilityLayer>
        <CartesianGrid strokeDasharray="3 3" stroke="#e6e9e4" vertical={false} />
        <XAxis dataKey="fecha" tickFormatter={(fecha) => String(fecha).slice(5).split("-").reverse().join("/")} tick={{ fontSize: 11, fill: "#6B7A72" }} minTickGap={28} />
        {unidades.map((unidad, indice) => <YAxis key={unidad} yAxisId={unidad} orientation={indice === 0 ? "left" : "right"} unit={` ${unidad}`} tickFormatter={formato_cantidad} width={54} tick={{ fontSize: 10, fill: "#6B7A72" }} domain={[(minimo: number) => Math.min(0, minimo), "auto"]} />)}
        <Tooltip labelFormatter={(fecha) => formato_fecha(String(fecha))} formatter={(valor, nombre) => [formato_cantidad(Number(valor)), nombre]} contentStyle={{ borderRadius: 12, borderColor: "#e6e9e4", fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
        {grafico.series.map((serie, indice) => <Line key={serie.clave} dataKey={serie.clave} name={`${serie.nombre} (${serie.unidad})`} yAxisId={serie.unidad} type="linear" stroke={colores[indice % colores.length]} strokeWidth={2} strokeDasharray={indice >= colores.length ? "5 3" : undefined} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />)}
      </LineChart>
    </ResponsiveContainer></div>
    <details className="mt-3 text-xs text-texto-secundario"><summary className="cursor-pointer">Ver datos en tabla</summary><div className="mt-2 max-h-56 overflow-auto" tabIndex={0} role="region" aria-label={`Datos de ${grafico.grupo}`}>
      <table className="w-full text-left"><caption className="sr-only">Stock diario al cierre en Bodega 2</caption><thead><tr><th scope="col" className="p-2">Fecha</th>{grafico.series.map((serie) => <th key={serie.clave} scope="col" className="p-2">{serie.nombre} ({serie.unidad})</th>)}</tr></thead><tbody>{grafico.datos.map((dia) => <tr key={String(dia.fecha)}><td className="p-2 whitespace-nowrap">{formato_fecha(String(dia.fecha))}</td>{grafico.series.map((serie) => <td key={serie.clave} className="p-2">{formato_cantidad(Number(dia[serie.clave]))}</td>)}</tr>)}</tbody></table>
    </div></details>
  </div>;
}
