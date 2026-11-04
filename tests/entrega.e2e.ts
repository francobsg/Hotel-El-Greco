import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import type { Page } from "playwright";
import { inventario_rutas } from "./rutas";
export async function probar_reportes_configuracion(pagina: Page, origen: string) {
  await pagina.goto(`${origen}/reportes?mes=10&ano=2026`);
  for (const bodega of [1, 2]) {
    const respuesta = await pagina.request.get(`${origen}/api/reportes?mes=10&ano=2026&bodega=${bodega}`); assert.equal(respuesta.status(), 200);
    const libro = new ExcelJS.Workbook(); await libro.xlsx.load(await respuesta.body() as unknown as Parameters<typeof libro.xlsx.load>[0]);
    const movimientos = libro.getWorksheet("Movimientos")!, resumen = libro.getWorksheet("Resumen")!;
    assert(movimientos.rowCount > 1 && resumen.rowCount >= 61); assert(movimientos.autoFilter);
    resumen.eachRow((fila, indice) => { if (indice > 1) assert(Math.abs(Number(fila.getCell(3).value) + Number(fila.getCell(4).value) - Number(fila.getCell(5).value) - Number(fila.getCell(6).value)) < 1e-6); });
  }
  await pagina.goto(`${origen}/estadisticas?inicio=2026-09-15&fin=2026-10-14&unidad=kg&bodega=2`);
  await pagina.getByRole("heading", { name: "Consumo por categoría", exact: true }).waitFor();
  await pagina.getByRole("combobox", { name: "Unidad", exact: true }).selectOption("lt");
  await pagina.getByRole("button", { name: "Aplicar rango", exact: true }).click();
  await pagina.waitForURL((u) => u.searchParams.get("unidad") === "lt");
  await pagina.goto(`${origen}/prediccion`); await pagina.getByText("Estimación · sin IA externa", { exact: true }).waitFor();
  const tabla = pagina.getByRole("region", { name: "Estimación de reposición", exact: true }); assert.equal(await tabla.locator("tbody tr").count(), 50);
  await pagina.getByRole("link", { name: "Siguiente", exact: true }).click(); await pagina.waitForURL((u) => u.searchParams.get("pagina") === "2");
  await pagina.goto(`${origen}/configuracion?recurso=categorias`);
  await pagina.getByRole("button", { name: "Nuevo registro", exact: true }).click();
  let modal = pagina.getByRole("dialog", { name: "Nuevo registro", exact: true });
  await modal.getByLabel("Nombre", { exact: true }).fill("Categoría prueba entrega");
  await modal.getByLabel("Grupo gráfico", { exact: true }).fill("Carnes");
  await modal.getByRole("button", { name: "Guardar", exact: true }).click();
  await pagina.getByRole("status").filter({ hasText: "Configuración guardada" }).waitFor();
  let fila = pagina.getByRole("row").filter({ hasText: "Categoría prueba entrega" });
  await fila.getByRole("button", { name: "Editar", exact: true }).click();
  modal = pagina.getByRole("dialog", { name: "Editar configuración", exact: true });
  await modal.getByLabel("Nombre", { exact: true }).fill("Categoría editada entrega");
  await modal.getByRole("button", { name: "Guardar", exact: true }).click();
  fila = pagina.getByRole("row").filter({ hasText: "Categoría editada entrega" }); await fila.waitFor();
  await fila.getByRole("button", { name: "Eliminar", exact: true }).click();
  await pagina.getByRole("dialog", { name: "Eliminar registro", exact: true }).getByRole("button", { name: "Confirmar eliminación", exact: true }).click();
  await pagina.getByRole("status").filter({ hasText: "Registro eliminado" }).waitFor();
  await pagina.goto(`${origen}/configuracion?recurso=platillos`); await pagina.getByRole("button", { name: "Nuevo registro", exact: true }).click();
  modal = pagina.getByRole("dialog", { name: "Nuevo registro", exact: true }); await modal.getByLabel("Nombre", { exact: true }).fill("Plato prueba entrega"); await modal.getByRole("button", { name: "Guardar", exact: true }).click();
  await pagina.getByRole("row").filter({ hasText: "Plato prueba entrega" }).waitFor();
  const catalogo_platos = await pagina.request.get(`${origen}/api/configuracion?recurso=platillos&buscar=Plato%20prueba%20entrega`);
  assert.equal(catalogo_platos.status(), 200);
  assert((await catalogo_platos.json()).filas.some((p: { nombre: string }) => p.nombre === "Plato prueba entrega"), "El platillo creado debe estar disponible en el catálogo.");
  await pagina.goto(`${origen}/configuracion?recurso=recetas`); await pagina.getByRole("button", { name: "Nuevo registro", exact: true }).click();
  modal = pagina.getByRole("dialog", { name: "Nuevo registro", exact: true });
  const buscar_plato = pagina.waitForResponse((r) => r.url().includes("/api/configuracion?") && new URL(r.url()).searchParams.get("buscar") === "Plato prueba entrega");
  await modal.getByLabel("Buscar platillo", { exact: true }).fill("Plato prueba entrega");
  const respuesta_buscar = await buscar_plato; assert.equal(respuesta_buscar.status(), 200); assert((await respuesta_buscar.json()).filas.length > 0);
  await modal.getByLabel("Seleccionar platillo", { exact: true }).locator("option").filter({ hasText: "Plato prueba entrega" }).waitFor({ state: "attached" });
  await modal.getByLabel("Seleccionar platillo", { exact: true }).selectOption({ label: "Plato prueba entrega" });
  await modal.getByLabel("Buscar producto", { exact: true }).fill("Arroz");
  await modal.getByLabel("Seleccionar producto", { exact: true }).locator("option").filter({ hasText: "Arroz" }).waitFor({ state: "attached" });
  await modal.getByLabel("Seleccionar producto", { exact: true }).selectOption({ label: "Arroz" });
  await modal.getByLabel("Gramos / ml por porción", { exact: true }).fill("100");
  await modal.getByRole("button", { name: "Guardar", exact: true }).click();
  await pagina.getByRole("row").filter({ hasText: "Plato prueba entrega" }).waitFor();
  await pagina.goto(`${origen}/configuracion?recurso=platillos`); fila = pagina.getByRole("row").filter({ hasText: "Plato prueba entrega" });
  await fila.getByRole("button", { name: "Eliminar", exact: true }).click(); await pagina.getByRole("button", { name: "Confirmar eliminación", exact: true }).click();
  await pagina.getByRole("status").filter({ hasText: "Registro eliminado" }).waitFor();
  console.info("OK: reportes Excel de ambas bodegas, cierre mensual, estadísticas por unidad, estimaciones paginadas y configuración CRUD.");
}
export async function revisar_responsivo(pagina: Page, origen: string, login = false) {
  for (const ancho of [360, 768, 1280]) {
    await pagina.setViewportSize({ width: ancho, height: 900 });
    for (const ruta of login ? ["/login"] : ["/", "/inventario", "/historial", "/guias/nueva", "/escaner", "/caja", "/reportes", "/estadisticas", "/prediccion", "/configuracion"]) {
      await pagina.goto(`${origen}${ruta}`); await pagina.locator("h1").waitFor();
      assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, `Desborde ${ancho}px ${ruta}`);
      if (ancho === 360) {
        const pequenos = await pagina.getByRole("button").evaluateAll((botones) => botones.filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 43.5 || r.width < 43.5); }).map((b) => b.textContent || b.getAttribute("aria-label")));
        assert.deepEqual(pequenos, [], `Botones menores a 44px: ${ruta}`);
      }
      await pagina.screenshot({ path: `test-results/entrega-${ancho}-${ruta.replace(/\//g, "") || "panel"}.png`, fullPage: true });
    }
  }
  await pagina.setViewportSize({ width: 1366, height: 768 });
  console.info(`OK: ${login ? "login" : "diez páginas"} a 360/768/1280px, sin desbordes y controles táctiles de 44px.`);
}
export async function auditar_permisos_http(admin: Page, trabajador: Page, origen: string) {
  for (const { ruta, metodos } of inventario_rutas()) {
    if (ruta.startsWith("/api/auth/") || ruta === "/login") continue;
    for (const metodo of metodos.filter((m) => m !== "GET")) {
      assert.equal((await admin.request.fetch(`${origen}${ruta}`, { method: metodo, headers: { Origin: origen }, data: {} })).status(), 403, `${metodo} admin ${ruta}`);
    }
    const permitida = ["/guias/nueva", "/escaner", "/caja"].some((r) => ruta === r || ruta.startsWith(`${r}/`)) || ruta === "/api/escaner";
    if (!permitida) {
      const respuesta = await trabajador.request.get(`${origen}${ruta}`, { maxRedirects: 0 });
      assert.equal(respuesta.status(), ruta.includes("/api/") ? 403 : 307, `GET trabajador ${ruta}`);
    }
  }
  for (const ruta of ["/reportes", "/estadisticas", "/prediccion", "/configuracion"]) {
    await admin.goto(`${origen}${ruta}`); await admin.locator("h1").waitFor();
    assert.equal(await admin.getByRole("button", { name: /^(Nuevo registro|Editar|Eliminar)$/ }).count(), 0);
  }
  const manifiesto = await (await trabajador.request.get(`${origen}/manifest.webmanifest`)).json();
  assert.equal(manifiesto.display, "standalone"); assert.equal(manifiesto.icons.length, 3);
  for (const icono of manifiesto.icons) { const respuesta = await trabajador.request.get(`${origen}${icono.src}`); assert.equal(respuesta.status(), 200); assert.equal((await respuesta.body()).subarray(1, 4).toString(), "PNG"); }
  assert.equal((await trabajador.request.get(`${origen}/sw.js`)).status(), 200);
  console.info("OK: auditoría HTTP de todas las rutas y mutaciones, admin solo lectura, trabajador restringido y PWA accesible.");
}
