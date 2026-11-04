import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { basename, dirname, join, resolve } from "node:path";
import { once } from "node:events";
import { setTimeout as esperar } from "node:timers/promises";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import { chromium, type Browser, type Page } from "playwright";

import * as esquema from "@/db/schema";
import { poblar_base_datos } from "@/db/seed/poblar";
import { nombre_cookie } from "@/lib/auth/token";
import { probar_inventario, probar_inventario_admin } from "./inventario.e2e";
import { probar_guias, probar_guias_trabajador } from "./guias.e2e";
import { probar_escaner } from "./escaner.e2e";
import { probar_caja } from "./caja.e2e";
import { crear_servicio_stock } from "@/lib/stock/servicio";
import { fecha_chile } from "@/lib/stats/tipos";
import { probar_reportes_configuracion, revisar_responsivo, auditar_permisos_http } from "./entrega.e2e";

async function puerto_libre() {
  const servidor = createServer();
  servidor.listen(0, "127.0.0.1");
  await once(servidor, "listening");
  const direccion = servidor.address();
  assert(direccion && typeof direccion !== "string");
  await new Promise<void>((resolve, reject) => servidor.close((error) => error ? reject(error) : resolve()));
  return direccion.port;
}

async function probar_flujo() {
  const cliente = await PGlite.create();
  const db = drizzle(cliente, { schema: esquema });
  const password = randomBytes(18).toString("base64url");
  await migrate(db, { migrationsFolder: "./db/migrations" });
  await poblar_base_datos(db, password, "2026-10-14");
  // Stock exclusivo de la base efimera para probar caja con todos los ingredientes disponibles.
  const ingredientes_caja = await db.selectDistinct({ producto_id: esquema.recetas.producto_id }).from(esquema.recetas);
  await crear_servicio_stock(db).registrarGuia({ tipo: "ajuste_positivo", bodega_destino_id: 2, fecha: fecha_chile(), usuario_id: 1, glosa: "Preparacion de prueba E2E caja", items: ingredientes_caja.map((i) => ({ producto_id: i.producto_id, cantidad: "5" })) });
  const socket = new PGLiteSocketServer({ db: cliente, host: "127.0.0.1", port: 0, maxConnections: 20 });
  await socket.start();
  const puerto = await puerto_libre();
  const origen = `http://127.0.0.1:${puerto}`;
  const facturas_temporales = await mkdtemp(join(tmpdir(), "greco-e2e-"));
  const servidor = spawn(process.execPath, [join(process.cwd(), "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(puerto)], {
    windowsHide: true,
    env: { ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", AUTH_SECRET: randomBytes(32).toString("hex"), FACTURAS_DIR: facturas_temporales, ESCANER_UPLOADS_DIR: join(facturas_temporales, "escaner"), OPENAI_API_KEY: "", SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "", DATABASE_POOL_MAX: "1", DATABASE_URL: `postgresql://postgres:prueba@${socket.getServerConn()}/postgres` },
    stdio: ["ignore", "pipe", "pipe"],
  });
  // Conservar salida solo para detectar el arranque; no imprimir consultas ni credenciales.
  servidor.stdout?.resume();
  let errores_servidor = "";
  servidor.stderr?.on("data", (datos) => { errores_servidor = (errores_servidor + String(datos)).slice(-131072); });
  let navegador: Browser | undefined;
  const errores_cliente: string[] = [];
  try {
    let listo = false;
    for (let intento = 0; intento < 80; intento++) {
      if (servidor.exitCode !== null) throw new Error("El servidor finalizo antes de arrancar.");
      try { if ((await fetch(`${origen}/login`)).ok) { listo = true; break; } } catch { /* Aun arrancando. */ }
      await esperar(250);
    }
    assert(listo, "El servidor no arranco.");
    navegador = await chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
    await mkdir("test-results", { recursive: true });
    async function ingresar(page: Page, email: string, destino: string) {
      page.on("pageerror", (error) => errores_cliente.push(error.message));
      await page.goto(`${origen}/login`);
      await page.getByLabel("Correo electrónico", { exact: true }).fill(email);
      await page.getByLabel("Contraseña", { exact: true }).fill(password);
      const respuesta_login = page.waitForResponse((respuesta) => respuesta.url().endsWith("/api/auth/login"));
      await page.getByRole("button", { name: "Iniciar Sesión", exact: true }).click();
      const respuesta = await respuesta_login;
      if (!respuesta.ok()) throw new Error(`Login fallo: ${(await respuesta.json()).error}`);
      assert.equal(respuesta.status(), 200);
      await page.waitForURL(`${origen}${destino}`);
      const cookie = (await page.context().cookies()).find((cookie) => cookie.name === nombre_cookie);
      assert(cookie?.httpOnly && cookie.secure && cookie.sameSite === "Lax", "Cookie de sesion insegura.");
    }
    const contexto = await navegador.newContext({ viewport: { width: 1366, height: 768 } });
    const pagina = await contexto.newPage();
    await pagina.goto(`${origen}/`);
    assert.equal(new URL(pagina.url()).pathname, "/login");
    assert(await pagina.getByAltText("Hotel Museo El Greco", { exact: true }).isVisible());
    await pagina.getByRole("button", { name: "Mostrar contraseña" }).click();
    assert.equal(await pagina.locator("#password").getAttribute("type"), "text");
    await pagina.getByRole("button", { name: "Ocultar contraseña" }).click();
    await revisar_responsivo(pagina, origen, true);
    await pagina.screenshot({ path: "test-results/login-escritorio.png", fullPage: true });
    await ingresar(pagina, "admin@hotelgreco.cl", "/");
    await pagina.goto(`${origen}/?fecha=2026-10-14&dias=30`);
    const indicadores = pagina.getByRole("region", { name: "Indicadores del inventario" });
    await indicadores.getByText("60", { exact: true }).waitFor();
    await pagina.getByRole("region", { name: "Stock de Bodega 2: Carnes", exact: true }).waitFor();
    await pagina.waitForFunction(() => document.querySelectorAll(".recharts-wrapper").length === 4);
    assert.equal(await pagina.getByRole("region", { name: "Últimos cinco movimientos", exact: true }).locator("tbody tr").count(), 5);
    assert.equal(await pagina.getByRole("link", { name: "Compra", exact: false }).filter({ hasText: "Entrada de proveedor" }).count(), 1);
    await pagina.screenshot({ path: "test-results/panel-escritorio.png", fullPage: true });
    await pagina.getByLabel("Período de los gráficos", { exact: true }).selectOption("7");
    await pagina.waitForURL((url) => url.searchParams.get("dias") === "7");
    await pagina.waitForFunction(() => document.querySelector('[aria-label="Stock de Bodega 2: Carnes"] tbody')?.children.length === 7);
    await pagina.getByLabel("Período de los gráficos", { exact: true }).selectOption("90");
    await pagina.waitForURL((url) => url.searchParams.get("dias") === "90");
    await pagina.waitForFunction(() => document.querySelector('[aria-label="Stock de Bodega 2: Carnes"] tbody')?.children.length === 90);
    await pagina.getByLabel("Bodega", { exact: true }).selectOption("2");
    await pagina.waitForURL((url) => url.searchParams.get("bodega") === "2");
    await pagina.getByLabel("Fecha de corte", { exact: true }).fill("2026-10-13");
    await pagina.waitForURL((url) => url.searchParams.get("fecha") === "2026-10-13");
    await pagina.getByRole("link", { name: "Ver todas", exact: true }).click();
    await pagina.waitForURL((url) => url.pathname === "/inventario");
    await pagina.getByRole("heading", { name: "Gestión de Inventario", exact: true }).waitFor();
    await pagina.getByText("Alertas Stock", { exact: true }).waitFor();
    assert.equal(new URL(pagina.url()).pathname, "/inventario");
    assert((await pagina.locator("tbody tr").count()) > 5);
    await pagina.goto(`${origen}/?fecha=2026-10-14&dias=30`);
    await pagina.getByRole("link", { name: "Ver todos", exact: true }).click();
    await pagina.waitForURL((url) => url.pathname === "/historial");
    await pagina.getByRole("heading", { name: "Historial General de Movimientos", exact: true }).waitFor();
    assert.equal(await pagina.locator("tbody tr").count(), 50);
    await pagina.getByRole("link", { name: "Siguiente →", exact: true }).click();
    await pagina.waitForURL((url) => url.searchParams.get("pagina") === "2");
    await pagina.goto(`${origen}/?fecha=2026-10-14&dias=30`);
    await indicadores.getByText("60", { exact: true }).waitFor();
    const [producto_refresco] = await db.insert(esquema.productos).values({ nombre: "Producto de refresco", categoria_id: 1, unidad: "kg" }).returning();
    await pagina.getByRole("button", { name: "Refrescar panel", exact: true }).click();
    await indicadores.getByText("61", { exact: true }).waitFor();
    await db.delete(esquema.productos).where(eq(esquema.productos.id, producto_refresco.id));
    await pagina.goto(`${origen}/?fecha=2026-01-01`);
    await pagina.getByText("No hay movimientos hasta esta fecha para la bodega seleccionada.", { exact: true }).waitFor();
    assert.equal(await pagina.getByText("No hay movimientos de Bodega 2 para este grupo hasta la fecha seleccionada.", { exact: true }).count(), 4);
    console.info("OK: panel con datos seed, cuatro graficos, 7/30/90 dias, filtros, refresco real, enlaces y estados vacios.");
    await probar_inventario(pagina, origen);
    const guia_prueba = await probar_guias(pagina, origen);
    await pagina.getByRole("link", { name: "Usuarios", exact: true }).click();
    await pagina.getByRole("heading", { name: "Gestión de Usuarios" }).waitFor();
    assert.equal(await pagina.locator("tbody tr").count(), 3);
    await pagina.screenshot({ path: "test-results/usuarios-superadmin.png", fullPage: true });
    await pagina.getByRole("button", { name: "Nuevo Usuario", exact: true }).click();
    const modal = pagina.getByRole("dialog", { name: "Nuevo Usuario", exact: true });
    await modal.getByLabel("Nombre", { exact: true }).fill("Usuario de navegador");
    await modal.getByLabel("Correo electrónico").fill("navegador@test.cl");
    await modal.getByLabel("Contraseña temporal").fill(password);
    await modal.getByRole("button", { name: "Guardar Usuario" }).click();
    await pagina.getByRole("status").filter({ hasText: "Usuario creado" }).waitFor();
    const fila = pagina.locator("tr").filter({ hasText: "navegador@test.cl" });
    await fila.getByRole("button", { name: "Editar", exact: true }).click();
    await pagina.getByRole("dialog", { name: "Editar Usuario" }).getByLabel("Nombre", { exact: true }).fill("Usuario actualizado");
    await pagina.getByRole("button", { name: "Guardar Usuario" }).click();
    await fila.getByText("Usuario actualizado", { exact: true }).waitFor();
    await fila.getByRole("button", { name: "Eliminar", exact: true }).click();
    await pagina.getByRole("button", { name: "Confirmar eliminación" }).click();
    await pagina.getByRole("status").filter({ hasText: "Usuario eliminado" }).waitFor();
    await pagina.waitForFunction(() => !document.querySelector("tbody")?.textContent?.includes("navegador@test.cl"));
    const propio = pagina.locator("tr").filter({ hasText: "admin@hotelgreco.cl" });
    assert(await propio.getByRole("button", { name: "Eliminar", exact: true }).isDisabled());
    const cuentas = await (await contexto.request.get(`${origen}/api/usuarios`)).json();
    const propietario = cuentas.find((usuario: { email: string }) => usuario.email === "admin@hotelgreco.cl");
    await probar_reportes_configuracion(pagina, origen);
    await revisar_responsivo(pagina, origen);
    const borrado_propio = await contexto.request.delete(`${origen}/api/usuarios/${propietario.id}`, { headers: { Origin: origen } });
    assert.equal(borrado_propio.status(), 409);
    const quitar_ultimo = await contexto.request.patch(`${origen}/api/usuarios/${propietario.id}`, { headers: { Origin: origen }, data: { nombre: propietario.nombre, email: propietario.email, rol: "admin", activo: true } });
    assert.equal(quitar_ultimo.status(), 409);
    const csrf = await contexto.request.post(`${origen}/api/usuarios`, { headers: { Origin: "https://otro-sitio.cl" }, data: {} });
    assert.equal(csrf.status(), 403);
    await pagina.getByRole("button", { name: "Cerrar sesión" }).click();
    await pagina.waitForURL(`${origen}/login`);
    await pagina.goto(`${origen}/usuarios`);
    assert.equal(new URL(pagina.url()).pathname, "/login");
    console.info("OK: superadmin, CRUD por formulario, ultimo superadmin, autoeliminacion, CSRF y logout.");

    const contexto_admin = await navegador.newContext({ viewport: { width: 1366, height: 768 } });
    const pagina_admin = await contexto_admin.newPage();
    await ingresar(pagina_admin, "admin.prueba@hotelgreco.cl", "/");
    await pagina_admin.goto(`${origen}/?fecha=2026-10-14`);
    await pagina_admin.getByRole("heading", { name: "Accesos Rápidos", exact: true }).waitFor();
    assert.equal(await pagina_admin.getByRole("link", { name: /^Compra/ }).count(), 0);
    await pagina_admin.setViewportSize({ width: 390, height: 844 });
    await pagina_admin.getByRole("region", { name: "Stock de Bodega 2: Carnes", exact: true }).waitFor();
    await pagina_admin.waitForFunction(() => document.querySelectorAll(".recharts-wrapper").length === 4);
    assert.equal(await pagina_admin.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await pagina_admin.screenshot({ path: "test-results/panel-admin-movil.png", fullPage: true });
    await pagina_admin.setViewportSize({ width: 1366, height: 768 });
    await pagina_admin.goto(`${origen}/usuarios`);
    assert.equal(await pagina_admin.getByRole("button", { name: "Nuevo Usuario" }).count(), 0);
    assert.equal(await pagina_admin.getByRole("button", { name: "Editar", exact: true }).count(), 0);
    await pagina_admin.screenshot({ path: "test-results/usuarios-admin.png", fullPage: true });
    for (const metodo of ["POST", "PATCH", "DELETE"]) {
      const respuesta = await contexto_admin.request.fetch(`${origen}/api/usuarios${metodo === "POST" ? "" : `/${propietario.id}`}`, { method: metodo, headers: { Origin: origen }, data: {} });
      assert.equal(respuesta.status(), 403);
    }
    assert.equal((await contexto_admin.request.post(`${origen}/usuarios`, { headers: { Origin: origen, "Next-Action": "accion-de-prueba" } })).status(), 403);
    console.info("OK: admin solo lectura, accesos rapidos ocultos, panel movil sin overflow, APIs y POST de server action bloqueados.");
    await probar_inventario_admin(pagina_admin, origen);
    assert.equal((await contexto_admin.request.post(`${origen}/guias/nueva/api/registrar`, { headers: { Origin: origen }, multipart: { datos: "{}" } })).status(), 403);
    assert.equal((await contexto_admin.request.get(guia_prueba.imagen)).status(), 200);

    const contexto_trabajador = await navegador.newContext({ viewport: { width: 1366, height: 768 } });
    const pagina_trabajador = await contexto_trabajador.newPage();
    await ingresar(pagina_trabajador, "trabajador.prueba@hotelgreco.cl", "/guias/nueva");
    await pagina_trabajador.goto(`${origen}/usuarios`);
    assert.equal(new URL(pagina_trabajador.url()).pathname, "/guias/nueva");
    assert.equal((await contexto_trabajador.request.get(`${origen}/api/usuarios`)).status(), 403);
    assert.equal((await contexto_trabajador.request.get(`${origen}/api/inventario/productos`)).status(), 403);
    assert.equal((await contexto_trabajador.request.post(`${origen}/api/inventario/traspasos`, { headers: { Origin: origen }, data: {} })).status(), 403);
    assert.equal(await pagina_trabajador.getByRole("link", { name: "Usuarios", exact: true }).count(), 0);
    console.info("OK: trabajador escritorio, destinos y rutas restringidas.");
    await probar_guias_trabajador(pagina_trabajador, origen, guia_prueba.imagen, guia_prueba.folio);

    const contexto_movil = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const pagina_movil = await contexto_movil.newPage();
    await pagina_movil.goto(`${origen}/login`);
    assert.equal(await pagina_movil.getByAltText("Hotel Museo El Greco", { exact: true }).isVisible(), false);
    await pagina_movil.screenshot({ path: "test-results/login-movil.png", fullPage: true });
    await ingresar(pagina_movil, "trabajador.prueba@hotelgreco.cl", "/escaner");
    await pagina_movil.getByRole("button", { name: "Abrir menú", exact: true }).click();
    const menu = pagina_movil.getByRole("dialog", { name: "Menú principal" });
    assert(await menu.getByRole("link", { name: "Escanear factura", exact: true }).isVisible());
    assert.equal(await menu.getByRole("link", { name: "Nueva guía", exact: true }).count(), 0);
    assert.equal(await menu.getByRole("link", { name: "Modo caja", exact: true }).count(), 0);
    await pagina_movil.screenshot({ path: "test-results/trabajador-movil.png", fullPage: true });
    assert.equal(await pagina_movil.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await menu.getByRole("button", { name: "Cerrar menú", exact: true }).click();
    await probar_escaner(pagina_movil, origen, contexto_admin.request);
    await probar_caja(pagina_movil, pagina_admin, origen);
    await auditar_permisos_http(pagina_admin, pagina_trabajador, origen);
    assert.deepEqual(errores_cliente, []);
    console.info("OK: trabajador movil -> escaner, menu exclusivo y sin overflow ni errores de React.");
    await contexto.close(); await contexto_admin.close(); await contexto_trabajador.close(); await contexto_movil.close();
  } catch (error) {
    const pagina_fallo = navegador?.contexts()[0]?.pages()[0];
    await pagina_fallo?.screenshot({ path: "test-results/flujo-fallo.png", fullPage: true });
    console.error("Errores de navegador:", errores_cliente);
    const diagnostico = errores_servidor.split(/\r?\n/).filter((linea) => /Error escaner:|TypeError:|ReferenceError:|RangeError:|\[cause\]:|code:|severity:|Error:/.test(linea)).map((linea) => linea.includes("Failed query") ? "Error de consulta SQL (texto omitido)." : linea.replace(/postgres(?:ql)?:\/\/\S+/g, "[conexion omitida]"));
    console.error("Diagnostico servidor:", diagnostico);
    throw error;
  } finally {
    await navegador?.close();
    if (servidor.exitCode === null) {
      const salida = once(servidor, "exit");
      servidor.kill();
      await salida;
    }
    await socket.stop();
    await esperar(20);
    await cliente.close();
    if (dirname(resolve(facturas_temporales)) === resolve(tmpdir()) && basename(facturas_temporales).startsWith("greco-e2e-")) await rm(facturas_temporales, { recursive: true, force: true });
  }
}

probar_flujo().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
