import { GestionUsuarios } from "@/components/usuarios/GestionUsuarios";
import { requirePage } from "@/lib/auth";
import { obtener_db } from "@/lib/db";
import { crear_servicio_usuarios } from "@/lib/usuarios/servicio";

export const metadata = { title: "Gestión de usuarios" };
export default async function PaginaUsuarios() {
  const sesion = await requirePage("superadmin", "admin");
  const usuarios = await crear_servicio_usuarios(obtener_db()).listar(sesion);
  return <GestionUsuarios usuarios={usuarios} rol={sesion.rol} usuario_id={sesion.id} />;
}
