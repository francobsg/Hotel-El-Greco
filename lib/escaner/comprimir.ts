export function dimensiones_comprimidas(ancho: number, alto: number) {
  if (ancho <= 0 || alto <= 0 || !Number.isFinite(ancho + alto)) throw new Error("La imagen no tiene dimensiones válidas.");
  const escala = Math.min(1, 1600 / Math.max(ancho, alto));
  return { ancho: Math.max(1, Math.round(ancho * escala)), alto: Math.max(1, Math.round(alto * escala)) };
}
export async function comprimir_factura(archivo: File): Promise<File> {
  if (!archivo.type.startsWith("image/")) throw new Error("Selecciona una imagen de la factura.");
  if (archivo.size > 30 * 1024 * 1024) throw new Error("La imagen original supera 30 MB. Toma una foto con menor resolución.");
  const url = URL.createObjectURL(archivo);
  try {
    const imagen = new Image(); imagen.src = url;
    await imagen.decode().catch(() => { throw new Error("No se pudo abrir la imagen. Usa una foto JPG, PNG o WebP."); });
    const { ancho, alto } = dimensiones_comprimidas(imagen.naturalWidth, imagen.naturalHeight);
    const canvas = document.createElement("canvas"); canvas.width = ancho; canvas.height = alto;
    const contexto = canvas.getContext("2d"); if (!contexto) throw new Error("No se pudo preparar la foto en este navegador.");
    contexto.fillStyle = "white"; contexto.fillRect(0, 0, ancho, alto); contexto.drawImage(imagen, 0, 0, ancho, alto);
    const contenido = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No se pudo comprimir la foto.")), "image/jpeg", 0.8));
    if (contenido.size > 3 * 1024 * 1024) throw new Error("La foto comprimida supera 3 MB. Acércate a la factura y toma otra foto.");
    return new File([contenido], "factura.jpg", { type: "image/jpeg" });
  } finally { URL.revokeObjectURL(url); }
}
