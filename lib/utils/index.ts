import { clsx, type ClassValue } from "clsx";

export function clases(...valores: ClassValue[]) {
  return clsx(valores);
}
