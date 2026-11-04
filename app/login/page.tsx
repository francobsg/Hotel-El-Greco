import { existsSync } from "node:fs";
import { join } from "node:path";
import { Headphones, Landmark, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/LoginForm";
import { Card } from "@/components/ui/Card";
import { obtener_sesion } from "@/lib/auth";
import { ruta_inicial } from "@/lib/auth/permisos";

export const metadata = { title: "Iniciar sesión" };
export default async function PaginaLogin() {
  const sesion = await obtener_sesion();
  if (sesion) redirect(ruta_inicial(sesion.rol, sesion.movil));
  const tiene_imagen = existsSync(join(process.cwd(), "public/img/hotel.jpg"));
  return (
    <main className="grid min-h-dvh bg-crema lg:grid-cols-[41%_59%]">
      <section aria-label="Hotel Museo El Greco" className="relative hidden min-h-dvh overflow-hidden rounded-br-[140px] border-r-2 border-dorado bg-linear-to-br from-verde-900 via-verde-700 to-verde-900 lg:block">
        {tiene_imagen && <Image src="/img/hotel.jpg" alt="Hotel Museo El Greco" fill priority unoptimized sizes="41vw" className="object-cover object-[65%_center]" />}
        <div className="absolute inset-0 bg-linear-to-b from-black/10 to-verde-900/50" />
        <div className="relative flex items-center gap-4 p-10 xl:p-14">
          <Landmark size={48} className="text-dorado" aria-hidden="true" />
          <p className="font-titulo text-2xl leading-tight font-semibold text-white drop-shadow-md">Hotel Museo<br />El Greco</p>
        </div>
        {!tiene_imagen && <Landmark size={300} strokeWidth={0.6} className="absolute right-6 bottom-20 text-dorado/20" aria-hidden="true" />}
      </section>
      <section className="flex flex-col items-center justify-center px-4 py-8 sm:px-8 lg:px-14">
        <Card className="w-full max-w-md border-0 px-6 py-8 sm:px-9 sm:py-9">
          <div className="text-center">
            <div className="mx-auto mb-5 flex size-20 items-center justify-center rounded-full border border-dorado/40 p-1.5">
              <div className="flex size-full items-center justify-center rounded-full bg-verde-900 text-dorado"><Landmark size={38} aria-hidden="true" /></div>
            </div>
            <h1 className="text-2xl font-semibold">Iniciar Sesión</h1>
            <p className="mt-2 text-sm text-texto-secundario">Ingresa tus credenciales para continuar</p>
          </div>
          <LoginForm />
          <div className="mt-7 flex items-center gap-3 text-texto-secundario"><span className="h-px flex-1 bg-dorado/25" /><ShieldCheck size={16} aria-hidden="true" /><span className="h-px flex-1 bg-dorado/25" /></div>
          <p className="mt-4 text-center text-xs text-verde-900">Hotel Museo El Greco © 2026</p>
        </Card>
        <div id="ayuda" className="mt-4 flex w-full max-w-md flex-wrap items-center gap-3 rounded-lg bg-verde-700/5 p-4">
          <Headphones size={24} className="text-verde-700" aria-hidden="true" />
          <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-verde-900">¿Necesitas ayuda?</p><p className="mt-1 text-[11px] text-texto-secundario">Contacta a la administración del hotel.</p></div>
          <a href="#ayuda" className="rounded-md border border-dorado px-3 py-2 text-xs text-dorado">Hablar con soporte</a>
        </div>
      </section>
    </main>
  );
}
