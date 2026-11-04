export function formato_cantidad(cantidad: string | number) {
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 }).format(Number(cantidad));
}
export function formato_fecha(fecha: string) {
  return new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Santiago" }).format(new Date(`${fecha}T12:00:00Z`));
}
