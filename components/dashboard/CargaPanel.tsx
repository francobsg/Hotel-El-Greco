import { Card } from "@/components/ui/Card";

export function CargaPanel() {
  return <div role="status" aria-label="Cargando panel" className="space-y-6"><p className="sr-only">Cargando datos del panel…</p><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((clave) => <Card key={clave}><div className="h-24 animate-pulse rounded-lg bg-verde-700/10 motion-reduce:animate-none" /></Card>)}</div><div className="grid gap-5 xl:grid-cols-2">{[1, 2].map((clave) => <Card key={clave}><div className="h-80 animate-pulse rounded-lg bg-verde-700/10 motion-reduce:animate-none" /></Card>)}</div></div>;
}
