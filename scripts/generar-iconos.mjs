import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
function crc32(b) { let c = 0xffffffff; for (const v of b) { c ^= v; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); } return (c ^ 0xffffffff) >>> 0; }
function chunk(tipo, datos) { const t = Buffer.from(tipo), n = Buffer.alloc(4), c = Buffer.alloc(4); n.writeUInt32BE(datos.length); c.writeUInt32BE(crc32(Buffer.concat([t, datos]))); return Buffer.concat([n, t, datos, c]); }
function icono(tamano) {
  const filas = Buffer.alloc(tamano * (1 + tamano * 4));
  for (let y = 0; y < tamano; y++) for (let x = 0; x < tamano; x++) {
    const xx = x / tamano, yy = y / tamano;
    const techo = yy >= 0.27 && yy <= 0.40 && Math.abs(xx - 0.5) <= (yy - 0.27) * 1.9;
    const borde = xx >= 0.25 && xx <= 0.75 && ((yy >= 0.40 && yy <= 0.45) || (yy >= 0.69 && yy <= 0.74));
    const pilares = yy >= 0.45 && yy <= 0.69 && [0.30, 0.47, 0.64].some((p) => xx >= p && xx <= p + 0.06);
    const color = techo || borde || pilares ? [184, 137, 43, 255] : [15, 61, 46, 255];
    const inicio = y * (1 + tamano * 4) + 1 + x * 4; color.forEach((c, i) => { filas[inicio + i] = c; });
  }
  const encabezado = Buffer.alloc(13); encabezado.writeUInt32BE(tamano); encabezado.writeUInt32BE(tamano, 4); encabezado[8] = 8; encabezado[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", encabezado), chunk("IDAT", deflateSync(filas)), chunk("IEND", Buffer.alloc(0))]);
}
mkdirSync("public/icons", { recursive: true });
for (const [nombre, tamano] of [["icon-192.png", 192], ["icon-512.png", 512], ["maskable-512.png", 512]]) writeFileSync(`public/icons/${nombre}`, icono(tamano));
