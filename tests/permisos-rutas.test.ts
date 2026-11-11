import { NextRequest } from "next/server";
import { afterEach, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";
import { firmar_sesion, nombre_cookie } from "@/lib/auth/token";
import { ruta_permitida } from "@/lib/auth/permisos";
import { inventario_rutas } from "./rutas";
import type { UsuarioSesion } from "@/lib/auth/permisos";
const actor: UsuarioSesion = { id: 1, nombre: "Prueba", email: "prueba@test.cl", rol: "admin", version_sesion: 0, movil: false };
afterEach(() => vi.unstubAllEnvs());
it("todas las mutaciones de rutas actuales y POST de server action estan bloqueados para admin", async () => {
  vi.stubEnv("AUTH_SECRET", "secreto-prueba-permisos-minimo-32-caracteres");
  const token = await firmar_sesion(actor, false);
  const rutas = inventario_rutas(); let comprobadas = 0;
  for (const { ruta, metodos } of rutas) {
    if (ruta === "/login" || ruta.startsWith("/api/auth/")) continue;
    for (const metodo of metodos.filter((m) => m !== "GET")) {
      expect((await proxy(new NextRequest(`http://localhost${ruta}`, { method: metodo, headers: { Cookie: `${nombre_cookie}=${token}` } }))).status, `${metodo} ${ruta}`).toBe(403); comprobadas++;
    }
    expect((await proxy(new NextRequest(`http://localhost${ruta}`, { method: "POST", headers: { Cookie: `${nombre_cookie}=${token}`, "Next-Action": "accion-prueba" } }))).status, `POST ${ruta}`).toBe(403);
  }
  expect(comprobadas).toBeGreaterThanOrEqual(12);
});
it("trabajador solo accede a sus tres utilidades y la excepcion exacta del escaner", async () => {
  vi.stubEnv("AUTH_SECRET", "secreto-prueba-permisos-minimo-32-caracteres");
  const token = await firmar_sesion({ ...actor, rol: "trabajador" }, false);
  for (const { ruta } of inventario_rutas()) {
    if (ruta === "/login" || ruta.startsWith("/api/auth/")) continue;
    const permitida = ["/guias/nueva", "/escaner", "/caja"].some((r) => ruta === r || ruta.startsWith(`${r}/`)) || ruta === "/api/escaner";
    expect(ruta_permitida("trabajador", ruta), ruta).toBe(permitida);
    const respuesta = await proxy(new NextRequest(`http://localhost${ruta}`, { headers: { Cookie: `${nombre_cookie}=${token}` } }));
    expect(respuesta.status, ruta).toBe(permitida ? 200 : ruta.includes("/api/") ? 403 : 307);
  }
  expect(ruta_permitida("trabajador", "/api/escaner/extra")).toBe(false);
  expect(ruta_permitida("trabajador", "/caja-ajena")).toBe(false);
});
it("API sin sesion devuelve 401 incluso bajo /caja y /guias; recursos PWA son publicos", async () => {
  for (const { ruta } of inventario_rutas().filter((r) => r.ruta.includes("/api/") && !r.ruta.startsWith("/api/auth/"))) {
    expect((await proxy(new NextRequest(`http://localhost${ruta}`))).status, ruta).toBe(401);
  }
  for (const ruta of ["/manifest.webmanifest", "/sw.js", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png"]) expect((await proxy(new NextRequest(`http://localhost${ruta}`))).status).toBe(200);
  expect((await proxy(new NextRequest("http://localhost/uploads/imagen.jpg"))).status).toBe(404);
});
