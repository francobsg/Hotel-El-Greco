"use client";

import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";

export function LoginForm() {
  const [visible, set_visible] = useState(false);
  const [enviando, set_enviando] = useState(false);
  const [error, set_error] = useState("");

  async function ingresar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    set_enviando(true);
    set_error("");
    const datos = new FormData(evento.currentTarget);
    try {
      const respuesta = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: datos.get("email"), password: datos.get("password"), movil: window.matchMedia("(max-width: 767px)").matches }) });
      const resultado = await respuesta.json();
      if (!respuesta.ok) throw new Error(resultado.error ?? "No se pudo iniciar sesión.");
      window.location.assign(resultado.destino);
    } catch (error) {
      set_error(error instanceof Error ? error.message : "No se pudo iniciar sesión.");
      set_enviando(false);
    }
  }

  return (
    <form onSubmit={ingresar} className="mt-7 space-y-5">
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium text-verde-900">Correo electrónico</label>
        <div className="relative">
          <Mail size={18} className="pointer-events-none absolute top-3.5 left-3.5 text-texto-secundario" aria-hidden="true" />
          <input id="email" name="email" type="email" required autoComplete="username" maxLength={254} placeholder="admin@hotelgreco.cl" className="min-h-11 w-full rounded-lg border border-verde-900/15 bg-crema/20 py-3 pr-3 pl-11 text-sm" />
        </div>
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium text-verde-900">Contraseña</label>
        <div className="relative">
          <LockKeyhole size={18} className="pointer-events-none absolute top-3.5 left-3.5 text-texto-secundario" aria-hidden="true" />
          <input id="password" name="password" type={visible ? "text" : "password"} required autoComplete="current-password" maxLength={72} placeholder="Ingresa tu contraseña" className="min-h-11 w-full rounded-lg border border-verde-900/15 bg-crema/20 py-3 pr-12 pl-11 text-sm" />
          <button type="button" aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={visible} onClick={() => set_visible(!visible)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-texto-secundario">{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        </div>
        <div className="mt-2 text-right"><a href="#ayuda" className="text-xs text-verde-900 underline-offset-4 hover:underline">¿Olvidaste tu contraseña?</a></div>
      </div>
      {error && <p role="alert" className="rounded-lg bg-critico/10 p-3 text-sm text-critico">{error}</p>}
      <Button type="submit" variante="acento" disabled={enviando} className="mt-1 w-full text-white">{enviando ? "Iniciando sesión…" : "Iniciar Sesión"}</Button>
    </form>
  );
}
