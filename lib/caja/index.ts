export type ResumenCajaDia = { fecha: string; items: { platillo: string; cantidad: number }[] };

export interface ParserResumenCaja {
  parsear(origen: unknown): Promise<ResumenCajaDia>;
}

export async function conciliarDia(fecha: string, resumen: ResumenCajaDia): Promise<never> {
  void fecha; void resumen;
  // TODO: definir formato y reglas del resumen diario antes de implementar la conciliacion. Sin rutas conectadas.
  throw new Error("No implementado");
}
