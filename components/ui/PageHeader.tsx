import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Propiedades = {
  icono: LucideIcon;
  titulo: string;
  subtitulo: string;
  acciones?: ReactNode;
  amplio?: boolean;
};

export function PageHeader({ icono: Icono, titulo, subtitulo, acciones, amplio = false }: Propiedades) {
  return (
    <header className={`flex flex-col gap-4 ${amplio ? "xl:flex-row xl:items-center xl:justify-between" : "sm:flex-row sm:items-center sm:justify-between"}`}>
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="shrink-0 rounded-tarjeta bg-verde-700/10 p-3 text-verde-700">
          <Icono size={26} aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">{titulo}</h1>
          <p className="mt-1 text-sm text-texto-secundario sm:text-base">{subtitulo}</p>
        </div>
      </div>
      {acciones && <div className="flex shrink-0 items-center gap-2">{acciones}</div>}
    </header>
  );
}
