import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
const css = readFileSync("app/globals.css", "utf8");
const color = (nombre: string) => { const valor = css.match(new RegExp(`--color-${nombre}: (#[0-9a-f]{6})`))?.[1]; if (!valor) throw new Error(`Color faltante ${nombre}`); return valor; };
function luminancia(hex: string) { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function contraste(a: string, b: string) { const l = [luminancia(a), luminancia(b)].sort((x, y) => y - x); return (l[0] + 0.05) / (l[1] + 0.05); }
it("texto, mensajes y botones principales cumplen contraste AA de texto normal", () => {
  for (const fondo of [color("crema"), color("tarjeta")]) for (const texto of ["texto", "texto-secundario", "verde-900", "verde-700", "critico", "bajo", "normal"]) expect(contraste(color(texto), fondo), `${texto} sobre ${fondo}`).toBeGreaterThanOrEqual(4.5);
  expect(contraste("#ffffff", color("verde-700"))).toBeGreaterThanOrEqual(4.5);
  expect(contraste("#ffffff", color("critico"))).toBeGreaterThanOrEqual(4.5);
  expect(contraste("#08251b", color("dorado"))).toBeGreaterThanOrEqual(4.5);
});
