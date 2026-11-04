import { afterEach, expect, it, vi } from "vitest";
import { MockOcr } from "@/lib/ocr/MockOcr";
import { OpenAiOcr } from "@/lib/ocr/OpenAiOcr";
import { factura_ocr } from "@/lib/ocr/tipos";
import { emparejar_items } from "@/lib/ocr/coincidencias";
import { dimensiones_comprimidas } from "@/lib/escaner/comprimir";
import { firmar_escaneo, validar_escaneo } from "@/lib/escaner/token";
import type { UsuarioSesion } from "@/lib/auth/permisos";
import type { ProductoInventario } from "@/lib/inventario/tipos";
const factura = { n_factura: "10", fecha: "2026-10-14", proveedor: "Proveedor", items: [{ descripcion: "Aceite vegetal", cantidad: 2.5, unidad: "lt", marca: null }] };
const imagen = new Uint8Array([255, 216, 255, 0]);
afterEach(() => { vi.unstubAllEnvs(); });
it("MockOcr devuelve datos de demostracion validados, sin mutaciones", async () => {
  const ocr = new MockOcr(); expect(ocr.demostracion).toBe(true);
  expect(factura_ocr.safeParse(await ocr.reconocer(imagen)).success).toBe(true);
  expect(factura_ocr.safeParse({ ...factura, instrucciones: "ignorar" }).success).toBe(false);
  expect(factura_ocr.safeParse({ ...factura, items: [{ ...factura.items[0], cantidad: -1 }] }).success).toBe(false);
});
it("OpenAI envia imagen base64, schema estricto y devuelve solo datos validados", async () => {
  const solicitar = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(factura) }] }] }));
  expect(await new OpenAiOcr("clave-prueba", "gpt-4.1-mini", solicitar).reconocer(imagen)).toEqual(factura);
  const opciones = solicitar.mock.calls[0][1]!; const cuerpo = JSON.parse(String(opciones.body));
  expect(cuerpo.store).toBe(false); expect(cuerpo.text.format).toMatchObject({ type: "json_schema", strict: true });
  expect(cuerpo.input[0].content[1]).toMatchObject({ type: "input_image", detail: "high" });
  expect(cuerpo.input[0].content[1].image_url).toMatch(/^data:image\/jpeg;base64,/);
});
it("rechaza JSON invalido, negativas/refusal, truncado y errores sin filtrar secretos", async () => {
  for (const respuesta of [{ status: "incomplete", output: [] }, { status: "completed", output: [{ type: "message", content: [{ type: "refusal" }] }] }, { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "no-json" }] }] }]) {
    const solicitar = vi.fn<typeof fetch>().mockResolvedValue(Response.json(respuesta));
    await expect(new OpenAiOcr("clave-prueba", undefined, solicitar).reconocer(imagen)).rejects.toThrow();
  }
  const ocupado = vi.fn<typeof fetch>().mockResolvedValue(new Response("detalle privado", { status: 429 }));
  await expect(new OpenAiOcr("clave-prueba", undefined, ocupado).reconocer(imagen)).rejects.toMatchObject({ estado: 429 });
  const lento = vi.fn<typeof fetch>().mockImplementation((_url, opciones) => new Promise((_resolve, reject) => { opciones?.signal?.addEventListener("abort", () => reject(opciones.signal?.reason), { once: true }); }));
  await expect(new OpenAiOcr("clave-prueba", undefined, lento, 20).reconocer(imagen)).rejects.toMatchObject({ estado: 504 });
});
it("fuzzy respeta tildes, diferencias menores, ambiguedad y unidad", () => {
  const base: ProductoInventario = { id: 1, nombre: "Aceite vegetal", categoria_id: 1, categoria: "Secos", unidad: "lt", marca: null, costo: "0", stock_1: "0", stock_2: "0", stock_critico: "0", stock_minimo: "0", stock_maximo: "0" };
  const item = { descripcion: "ACEÍTE VEJETAL 1 LT", cantidad: 1, unidad: "lt" as const, marca: null };
  expect(emparejar_items([item], [base])[0].producto?.id).toBe(1);
  expect(emparejar_items([{ ...item, unidad: "caja" }], [base])[0].producto).toBeNull();
  expect(emparejar_items([{ ...item, descripcion: "Salmon" }], [base])[0].producto).toBeNull();
  expect(emparejar_items([item], [base, { ...base, id: 2 }])[0].producto).toBeNull();
});
it("compresion limita el lado mayor a 1600px y no agranda imagenes", () => {
  expect(dimensiones_comprimidas(4000, 3000)).toEqual({ ancho: 1600, alto: 1200 });
  expect(dimensiones_comprimidas(2000, 6000)).toEqual({ ancho: 533, alto: 1600 });
  expect(dimensiones_comprimidas(800, 600)).toEqual({ ancho: 800, alto: 600 });
});
it("revision firmada pertenece al usuario y version de sesion; rechaza manipulacion", async () => {
  vi.stubEnv("AUTH_SECRET", "secreto-temporal-de-ocr-de-al-menos-32-caracteres");
  const actor: UsuarioSesion = { id: 1, nombre: "Operador", email: "operador@test.cl", rol: "trabajador", activo: true, version_sesion: 0, movil: true } as UsuarioSesion;
  const imagen_almacenada = { imagen_url: "http://localhost/escaner/imagen/local/1/11111111-1111-4111-8111-111111111111.jpg", ruta: "1/11111111-1111-4111-8111-111111111111.jpg", almacenamiento: "local" as const, descartar: async () => {} };
  const token = await firmar_escaneo(actor, imagen_almacenada);
  expect((await validar_escaneo(token, actor)).usuario_id).toBe(1);
  await expect(validar_escaneo(token, { ...actor, id: 2 })).rejects.toMatchObject({ estado: 403 });
  await expect(validar_escaneo(token, { ...actor, version_sesion: 1 })).rejects.toMatchObject({ estado: 403 });
  await expect(validar_escaneo(token + "alterado", actor)).rejects.toMatchObject({ estado: 403 });
});
