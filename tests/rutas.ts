import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
export function inventario_rutas(directorio = "app", partes: string[] = []): { ruta: string; metodos: string[] }[] {
  return readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
    const archivo = join(directorio, entrada.name);
    if (entrada.isDirectory()) return inventario_rutas(archivo, entrada.name.startsWith("(") ? partes : [...partes, entrada.name]);
    if (!["route.ts", "page.tsx"].includes(entrada.name)) return [];
    const ruta = "/" + partes.map((p) => p === "[recurso]" ? "categorias" : p === "[folio]" ? "G1-000001" : p === "[almacenamiento]" ? "local" : p === "[archivo]" ? "00000000-0000-4000-8000-000000000000.jpg" : p.startsWith("[") ? "1" : p).join("/");
    const metodos = entrada.name === "page.tsx" ? ["GET"] : [...readFileSync(archivo, "utf8").matchAll(/export\s+(?:async\s+function|const)\s+(GET|POST|PATCH|DELETE|PUT)\b/g)].map((m) => m[1]);
    return [{ ruta, metodos }];
  });
}
