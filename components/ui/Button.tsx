import type { ButtonHTMLAttributes } from "react";

import { clases } from "@/lib/utils";

const variantes = {
  primario: "bg-verde-700 text-white hover:bg-verde-900",
  secundario: "border border-verde-700 bg-transparent text-verde-700 hover:bg-verde-700/5",
  acento: "bg-dorado text-[#08251b] hover:bg-dorado/85",
  informativo: "border border-blue-300 bg-transparent text-blue-700 hover:bg-blue-50",
  peligro: "border border-critico/40 bg-transparent text-critico hover:bg-critico/5",
  destructivo: "bg-critico text-white hover:bg-critico/90",
  transparente: "border border-white/15 bg-transparent text-white hover:bg-white/10",
};

type Propiedades = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: keyof typeof variantes;
};

export function Button({ variante = "primario", className, type = "button", ...propiedades }: Propiedades) {
  return (
    <button
      type={type}
      className={clases(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variantes[variante],
        className,
      )}
      {...propiedades}
    />
  );
}
