"use client";

import { Plus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { etiquetas_rol, type Rol } from "@/lib/auth/permisos";
import type { UsuarioListado } from "@/lib/usuarios/servicio";

export function GestionUsuarios({ usuarios, rol, usuario_id }: { usuarios: UsuarioListado[]; rol: Rol; usuario_id: number }) {
  const router = useRouter();
  const [abierto, set_abierto] = useState(false);
  const [seleccionado, set_seleccionado] = useState<UsuarioListado | null>(null);
  const [eliminando, set_eliminando] = useState<UsuarioListado | null>(null);
  const [enviando, set_enviando] = useState(false);
  const [error, set_error] = useState("");
  const [mensaje, set_mensaje] = useState("");
  const puede_editar = rol === "superadmin";
  const estilo_input = "mt-2 min-h-11 w-full rounded-lg border border-verde-900/20 bg-white px-3 py-2 text-sm";

  function abrir(usuario: UsuarioListado | null) { set_seleccionado(usuario); set_error(""); set_abierto(true); }
  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault(); set_enviando(true); set_error("");
    const formulario = new FormData(evento.currentTarget);
    const password = formulario.get("password");
    try {
      const respuesta = await fetch(seleccionado ? `/api/usuarios/${seleccionado.id}` : "/api/usuarios", { method: seleccionado ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: formulario.get("nombre"), email: formulario.get("email"), rol: formulario.get("rol"), activo: formulario.get("activo") === "on", ...(password ? { password } : {}) }) });
      const resultado = await respuesta.json();
      if (!respuesta.ok) throw new Error(resultado.error);
      if (resultado.requiere_reingreso) { router.replace("/login"); router.refresh(); return; }
      set_abierto(false); set_mensaje(seleccionado ? "Usuario actualizado." : "Usuario creado."); router.refresh();
    } catch (error) { set_error(error instanceof Error ? error.message : "No se pudo guardar."); }
    finally { set_enviando(false); }
  }
  async function eliminar() {
    if (!eliminando) return;
    set_enviando(true); set_error("");
    try {
      const respuesta = await fetch(`/api/usuarios/${eliminando.id}`, { method: "DELETE" });
      const resultado = await respuesta.json();
      if (!respuesta.ok) throw new Error(resultado.error);
      set_eliminando(null); set_mensaje("Usuario eliminado."); router.refresh();
    } catch (error) { set_error(error instanceof Error ? error.message : "No se pudo eliminar."); }
    finally { set_enviando(false); }
  }
  return (
    <>
      <div className="border-b border-dorado/25 pb-7"><PageHeader icono={Users} titulo="Gestión de Usuarios" subtitulo="Administra los usuarios del sistema y sus permisos de acceso." acciones={puede_editar && <Button onClick={() => abrir(null)}><Plus size={19} aria-hidden="true" />Nuevo Usuario</Button>} /></div>
      {!puede_editar && <p className="rounded-lg bg-verde-700/5 p-3 text-sm text-verde-900">Acceso de solo lectura.</p>}
      {mensaje && <p role="status" className="text-sm text-normal">{mensaje}</p>}
      <Card className="p-3 sm:p-3">
        <DataTable<UsuarioListado> titulo="Usuarios del sistema" estilo_encabezado="claro" filas={usuarios} clave_fila={(usuario) => usuario.id} columnas={[
          { clave: "nombre", titulo: "Nombre", contenido: (usuario) => <span className="font-semibold">{usuario.nombre}</span> },
          { clave: "email", titulo: "Email", contenido: (usuario) => usuario.email },
          { clave: "rol", titulo: "Rol", contenido: (usuario) => <Badge estado={usuario.rol === "superadmin" ? "critico" : usuario.rol === "admin" ? "bajo" : "normal"}>{etiquetas_rol[usuario.rol]}</Badge> },
          { clave: "estado", titulo: "Estado", contenido: (usuario) => <Badge estado={usuario.activo ? "normal" : "critico"}>{usuario.activo ? "Activo" : "Inactivo"}</Badge> },
          { clave: "acciones", titulo: "Acciones", contenido: (usuario) => puede_editar ? <div className="flex gap-3"><Button variante="informativo" className="min-h-9 px-4 text-xs" onClick={() => abrir(usuario)}>Editar</Button><Button variante="peligro" className="min-h-9 px-4 text-xs" disabled={usuario.id === usuario_id} title={usuario.id === usuario_id ? "No puedes eliminar tu propia cuenta" : undefined} onClick={() => { set_error(""); set_eliminando(usuario); }}>Eliminar</Button></div> : <span className="text-texto-secundario">Solo lectura</span> },
        ]} />
      </Card>
      <Modal abierto={abierto} bloqueado={enviando} titulo={seleccionado ? "Editar Usuario" : "Nuevo Usuario"} al_cerrar={() => { if (!enviando) set_abierto(false); }}>
        {abierto && <form key={seleccionado?.id ?? "nuevo"} onSubmit={guardar} className="space-y-4">
          <div><label htmlFor="nombre-usuario" className="text-sm font-medium">Nombre</label><input id="nombre-usuario" name="nombre" required minLength={2} maxLength={150} defaultValue={seleccionado?.nombre} className={estilo_input} /></div>
          <div><label htmlFor="email-usuario" className="text-sm font-medium">Correo electrónico</label><input id="email-usuario" name="email" type="email" required maxLength={254} defaultValue={seleccionado?.email} className={estilo_input} /></div>
          <div><label htmlFor="rol-usuario" className="text-sm font-medium">Rol</label><select id="rol-usuario" name="rol" defaultValue={seleccionado?.rol ?? "trabajador"} className={estilo_input}><option value="superadmin">SuperAdmin</option><option value="admin">Administrador (solo lectura)</option><option value="trabajador">Trabajador</option></select></div>
          <div><label htmlFor="clave-usuario" className="text-sm font-medium">{seleccionado ? "Nueva contraseña (opcional)" : "Contraseña temporal"}</label><input id="clave-usuario" name="password" type="password" required={!seleccionado} minLength={12} maxLength={72} autoComplete="new-password" className={estilo_input} /><p className="mt-1 text-xs text-texto-secundario">Al menos 12 caracteres.{seleccionado && " Déjala vacía para conservarla."}</p></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="activo" defaultChecked={seleccionado?.activo ?? true} className="size-4 accent-verde-700" />Usuario activo</label>
          {error && <p role="alert" className="rounded-lg bg-critico/10 p-3 text-sm text-critico">{error}</p>}
          <div className="flex justify-end gap-3 pt-3"><Button variante="secundario" disabled={enviando} onClick={() => set_abierto(false)}>Cancelar</Button><Button type="submit" disabled={enviando}>{enviando ? "Guardando…" : "Guardar Usuario"}</Button></div>
        </form>}
      </Modal>
      <Modal abierto={!!eliminando} bloqueado={enviando} titulo="Eliminar Usuario" al_cerrar={() => { if (!enviando) set_eliminando(null); }}>
        <p className="text-sm">¿Eliminar a <strong>{eliminando?.nombre}</strong>? Esta acción es permanente.</p>
        {error && <p role="alert" className="mt-4 text-sm text-critico">{error}</p>}
        <div className="mt-6 flex justify-end gap-3"><Button variante="secundario" disabled={enviando} onClick={() => set_eliminando(null)}>Cancelar</Button><Button variante="destructivo" disabled={enviando} onClick={eliminar}>{enviando ? "Eliminando…" : "Confirmar eliminación"}</Button></div>
      </Modal>
    </>
  );
}
