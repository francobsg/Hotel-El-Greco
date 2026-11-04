import Link from "next/link";
import { Card } from "@/components/ui/Card";
export default function GuiaNoEncontrada() { return <Card><h1 className="text-2xl">Guía no encontrada</h1><p className="my-4 text-sm text-texto-secundario">Verifica el folio e inténtalo nuevamente.</p><Link href="/historial" className="text-verde-700 underline">Volver al historial</Link></Card>; }
