import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import * as esquema from "@/db/schema";
import { poblar_base_datos } from "@/db/seed/poblar";
import { ruta_inicial, ruta_permitida, type UsuarioSesion } from "@/lib/auth/permisos";
import { crear_servicio_auth, validar_rol } from "@/lib/auth/servicio";
import { firmar_sesion, leer_token } from "@/lib/auth/token";
import { crear_servicio_usuarios } from "@/lib/usuarios/servicio";
import { validar_origen } from "@/lib/auth/http";

const cliente = new PGlite();
const db = drizzle(cliente, { schema: esquema });
const auth = crear_servicio_auth(db);
const usuarios = crear_servicio_usuarios(db);
const password = "clave-temporal-prueba";
let superadmin: UsuarioSesion;
let admin: UsuarioSesion;
let trabajador: UsuarioSesion;

beforeAll(async () => {
  vi.stubEnv("AUTH_SECRET", "secreto-de-prueba-de-al-menos-32-caracteres");
  await migrate(db, { migrationsFolder: "./db/migrations" });
  await poblar_base_datos(db, password, "2026-10-14");
  superadmin = await auth.autenticar({ email: "admin@hotelgreco.cl", password });
  admin = await auth.autenticar({ email: "admin.prueba@hotelgreco.cl", password });
  trabajador = await auth.autenticar({ email: "trabajador.prueba@hotelgreco.cl", password });
});
afterAll(async () => { vi.unstubAllEnvs(); await cliente.close(); });

describe("autenticacion y permisos", () => {
  it("valida el Host externo de Next y rechaza origenes ajenos o ausentes", () => {
    const request = (origen?: string, sitio = "same-origin") => new Request("http://localhost:3000/api/auth/login", { headers: { host: "127.0.0.1:3100", ...(origen ? { origin: origen } : {}), "sec-fetch-site": sitio } });
    expect(() => validar_origen(request("http://127.0.0.1:3100"))).not.toThrow();
    for (const origen of [undefined, "null", "https://otro-sitio.cl", "http://127.0.0.1:3101", "http://127.0.0.1:3100/ruta", "http://usuario@127.0.0.1:3100"]) expect(() => validar_origen(request(origen))).toThrow("no permitida");
    expect(() => validar_origen(request("http://127.0.0.1:3100", "cross-site"))).toThrow("no permitida");
  });
  it("autentica los tres usuarios seed y calcula el destino por rol/dispositivo", () => {
    expect([superadmin.rol, admin.rol, trabajador.rol]).toEqual(["superadmin", "admin", "trabajador"]);
    expect(ruta_inicial(superadmin.rol, false)).toBe("/");
    expect(ruta_inicial(admin.rol, true)).toBe("/");
    expect(ruta_inicial(trabajador.rol, true)).toBe("/escaner");
    expect(ruta_inicial(trabajador.rol, false)).toBe("/guias/nueva");
    expect(superadmin).not.toHaveProperty("password_hash");
  });
  it("rechaza clave incorrecta, email inexistente y cuenta inactiva", async () => {
    await expect(auth.autenticar({ email: superadmin.email, password: "incorrecta" })).rejects.toThrow("incorrectos");
    await expect(auth.autenticar({ email: "inexistente@test.cl", password })).rejects.toThrow("incorrectos");
    await db.update(esquema.usuarios).set({ activo: false }).where(eq(esquema.usuarios.id, trabajador.id));
    await expect(auth.autenticar({ email: trabajador.email, password })).rejects.toThrow("incorrectos");
    await db.update(esquema.usuarios).set({ activo: true }).where(eq(esquema.usuarios.id, trabajador.id));
  });
  it("valida firma/rol y rechaza token manipulado o secreto ausente", async () => {
    const token = await firmar_sesion(admin, false);
    expect(await auth.sesion_actual(token)).toMatchObject({ id: admin.id, rol: "admin" });
    expect(await leer_token(`${token.slice(0, -10)}manipulado`)).toBeNull();
    vi.stubEnv("AUTH_SECRET", "");
    expect(await leer_token(token)).toBeNull();
    vi.stubEnv("AUTH_SECRET", "secreto-de-prueba-de-al-menos-32-caracteres");
  });
  it("bloquea toda mutacion del admin y las rutas ajenas del trabajador", () => {
    expect(() => validar_rol(superadmin, ["trabajador"], true)).not.toThrow();
    expect(() => validar_rol(admin, ["admin", "superadmin"], true)).toThrow("permiso");
    expect(() => validar_rol(null, ["superadmin"])).toThrow("Inicia sesion");
    for (const ruta of ["/", "/usuarios", "/api/usuarios", "/inventario", "/escaner-falso", "/guias/nuevas"]) expect(ruta_permitida("trabajador", ruta)).toBe(false);
    for (const ruta of ["/guias/nueva", "/escaner", "/caja"]) expect(ruta_permitida("trabajador", ruta)).toBe(true);
  });
});

describe("gestion de usuarios", () => {
  const datos = { nombre: "Usuario nuevo", email: "nuevo@test.cl", rol: "trabajador" as const, activo: true, password };
  it("permite lectura al admin y deniega crear/editar/eliminar a admin y trabajador", async () => {
    const lista = await usuarios.listar(admin);
    expect(lista).toHaveLength(3);
    expect(lista[0]).not.toHaveProperty("password_hash");
    for (const actor of [admin, trabajador]) {
      await expect(usuarios.guardar(actor, datos)).rejects.toThrow("permiso");
      await expect(usuarios.guardar(actor, datos, superadmin.id)).rejects.toThrow("permiso");
      await expect(usuarios.eliminar(actor, superadmin.id)).rejects.toThrow("permiso");
    }
  });
  it("superadmin crea, cambia clave/rol y elimina; cambios y borrado revocan sesiones", async () => {
    const nuevo = await usuarios.guardar(superadmin, datos);
    const original = await auth.autenticar({ email: nuevo.email, password });
    const token = await firmar_sesion(original, false);
    await expect(usuarios.guardar(superadmin, { ...datos, email: "NUEVO@test.cl" })).rejects.toThrow("Ya existe");
    await usuarios.guardar(superadmin, { ...datos, password: "clave-temporal-modificada", rol: "admin" }, nuevo.id);
    expect(await auth.sesion_actual(token)).toBeNull();
    await expect(auth.autenticar({ email: nuevo.email, password })).rejects.toThrow("incorrectos");
    const cambiado = await auth.autenticar({ email: nuevo.email, password: "clave-temporal-modificada" });
    expect(cambiado.rol).toBe("admin");
    const nuevo_token = await firmar_sesion(cambiado, false);
    await usuarios.eliminar(superadmin, nuevo.id);
    expect(await auth.sesion_actual(nuevo_token)).toBeNull();
  });
  it("impide autoeliminacion y desactivar o degradar al ultimo superadmin", async () => {
    await expect(usuarios.eliminar(superadmin, superadmin.id)).rejects.toThrow("propia cuenta");
    const cuenta = { nombre: superadmin.nombre, email: superadmin.email, rol: "admin", activo: true };
    await expect(usuarios.guardar(superadmin, cuenta, superadmin.id)).rejects.toThrow("superadmin activo");
    await expect(usuarios.guardar(superadmin, { ...cuenta, rol: "superadmin", activo: false }, superadmin.id)).rejects.toThrow("superadmin activo");
    const actor_falso = { ...trabajador, rol: "superadmin" as const };
    await expect(usuarios.eliminar(actor_falso, superadmin.id)).rejects.toThrow("gestionar usuarios");
  });
  it("protege el ultimo superadmin incluso ante otra identidad superadmin inactiva", async () => {
    const otro = await usuarios.guardar(superadmin, { ...datos, email: "otro@test.cl", rol: "superadmin" });
    const actor = await auth.autenticar({ email: otro.email, password });
    await usuarios.guardar(superadmin, { nombre: otro.nombre, email: otro.email, rol: "superadmin", activo: false }, otro.id);
    await expect(usuarios.eliminar(actor, superadmin.id)).rejects.toThrow("sesion");
    await usuarios.eliminar(superadmin, otro.id);
  });
});
