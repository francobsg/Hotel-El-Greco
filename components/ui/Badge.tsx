import type { HTMLAttributes } from "react";

import { clases } from "@/lib/utils";

const estados = {
  normal: { etiqueta: "Normal", estilo: "bg-normal/10 text-green-800" },
  bajo: { etiqueta: "Bajo", estilo: "bg-bajo/10 text-amber-800" },
  critico: { etiqueta: "Crítico", estilo: "bg-critico/10 text-red-700" },
};

type Propiedades = HTMLAttributes<HTMLSpanElement> & {
  estado: keyof typeof estados;
};

export function Badge({ estado, children, className, ...propiedades }: Propiedades) {
  return (
    <span
      className={clases("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", estados[estado].estilo, className)}
      {...propiedades}
    >
      {children ?? estados[estado].etiqueta}
    </span>
  );
}
