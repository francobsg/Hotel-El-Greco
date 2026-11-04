import type { HTMLAttributes } from "react";

import { clases } from "@/lib/utils";

export function Card({ className, ...propiedades }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clases("rounded-tarjeta border border-verde-900/5 bg-tarjeta p-5 shadow-tarjeta sm:p-6", className)}
      {...propiedades}
    />
  );
}
