"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function ErrorAplicacion({ reset }: { reset: () => void }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  return <Card><h1 className="text-xl">No se pudieron cargar los datos</h1><p role="alert" className="my-4 text-sm text-texto-secundario">Comprueba la conexión a la base de datos e inténtalo nuevamente.</p><Button disabled={pendiente} onClick={() => iniciar(() => { router.refresh(); reset(); })}>{pendiente ? "Cargando…" : "Reintentar"}</Button></Card>;
}
