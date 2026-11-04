import type { ReactNode } from "react";

export type ColumnaTabla<Fila> = {
  clave: string;
  titulo: string;
  contenido: (fila: Fila) => ReactNode;
};

type Propiedades<Fila> = {
  columnas: ColumnaTabla<Fila>[];
  filas: Fila[];
  clave_fila: (fila: Fila) => string | number;
  titulo: string;
  mensaje_vacio?: ReactNode;
  estilo_encabezado?: "oscuro" | "claro";
  compacta?: boolean;
};

export function DataTable<Fila>({ columnas, filas, clave_fila, titulo, mensaje_vacio = "No hay registros para mostrar.", estilo_encabezado = "oscuro", compacta = false }: Propiedades<Fila>) {
  return (
    <div className="overflow-x-auto rounded-tarjeta border border-verde-900/10 focus-visible:outline-dorado" role="region" aria-label={titulo} tabIndex={0}>
      <table className={`w-full border-collapse text-left text-sm ${compacta ? "min-w-[420px]" : "min-w-[560px]"}`}>
        <caption className="sr-only">{titulo}</caption>
        <thead className={estilo_encabezado === "claro" ? "bg-crema/70 text-verde-900" : "bg-verde-700 text-white"}>
          <tr>
            {columnas.map((columna) => (
              <th key={columna.clave} scope="col" className="px-4 py-3 font-semibold">{columna.titulo}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-verde-900/10 bg-tarjeta">
          {filas.length ? filas.map((fila) => (
            <tr key={clave_fila(fila)} className="hover:bg-crema/60">
              {columnas.map((columna) => (
                <td key={columna.clave} className="px-4 py-4">{columna.contenido(fila)}</td>
              ))}
            </tr>
          )) : (
            <tr>
              <td colSpan={columnas.length} className="px-4 py-10 text-center text-texto-secundario">{mensaje_vacio}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
