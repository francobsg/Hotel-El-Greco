import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";

import { Card } from "@/components/ui/Card";

type Propiedades = {
  titulo: string;
  valor: ReactNode;
  descripcion?: string;
  icono: LucideIcon;
  enlace?: string;
  texto_enlace?: string;
  tono?: "verde" | "alerta" | "dorado";
};

export function KpiCard({ titulo, valor, descripcion, icono: Icono, enlace, texto_enlace, tono = "verde" }: Propiedades) {
  const colores = { verde: "bg-verde-700/10 text-verde-700", alerta: "bg-critico/10 text-critico", dorado: "bg-dorado/10 text-dorado" };
  return (
    <Card>
      <div className="flex items-start gap-4">
        <div className={`rounded-full p-3 ${colores[tono]}`}>
          <Icono size={25} aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-texto text-xs font-semibold text-verde-900 uppercase">{titulo}</h2>
          <p className="mt-3 font-titulo text-3xl font-semibold text-verde-900">{valor}</p>
        </div>
      </div>
      {descripcion && <p className="mt-3 text-sm text-texto-secundario">{descripcion}</p>}
      {enlace && <Link href={enlace} className="mt-4 block text-xs font-medium text-verde-700 hover:underline">{texto_enlace ?? "Ver detalles"} →</Link>}
    </Card>
  );
}
