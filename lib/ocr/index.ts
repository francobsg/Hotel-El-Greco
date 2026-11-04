import "server-only";
import { MockOcr } from "./MockOcr";
import { OpenAiOcr } from "./OpenAiOcr";
export type { FacturaOcr } from "./tipos";
export function obtener_ocr(contexto: "factura" | "boleta" = "factura") {
  const clave = process.env.OPENAI_API_KEY?.trim();
  return clave ? new OpenAiOcr(clave, process.env.OPENAI_OCR_MODEL?.trim() || "gpt-4.1-mini", fetch, 45000, contexto) : new MockOcr(contexto);
}
