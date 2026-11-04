export const roles = ["superadmin", "admin", "trabajador"] as const;
export type Rol = typeof roles[number];
export type UsuarioSesion = { id: number; nombre: string; email: string; rol: Rol; version_sesion: number; movil: boolean };
export const etiquetas_rol: Record<Rol, string> = { superadmin: "SuperAdmin", admin: "Administrador", trabajador: "Trabajador" };

const rutas_trabajador = ["/guias/nueva", "/escaner", "/caja"];
export function ruta_permitida(rol: Rol, ruta: string) {
  return rol !== "trabajador" || ruta === "/api/escaner" || rutas_trabajador.some((permitida) => ruta === permitida || ruta.startsWith(`${permitida}/`));
}
export function ruta_inicial(rol: Rol, movil: boolean) {
  return rol === "trabajador" ? movil ? "/escaner" : "/guias/nueva" : "/";
}
export function mutacion_permitida(rol: Rol) { return rol !== "admin"; }
