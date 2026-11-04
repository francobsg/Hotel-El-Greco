import { Card } from "@/components/ui/Card";
export default function CargandoInventario() {
  return <Card><p role="status">Cargando inventario…</p><div aria-hidden="true" className="mt-5 h-64 animate-pulse rounded-lg bg-crema" /></Card>;
}
