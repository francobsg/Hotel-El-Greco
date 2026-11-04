import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { id: "/", name: "Inventario · Hotel Museo El Greco", short_name: "El Greco", description: "Inventario, guías y caja del Hotel Museo El Greco.", lang: "es-CL", start_url: "/", scope: "/", display: "standalone", background_color: "#F7F4EC", theme_color: "#0F3D2E", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" }, { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" }, { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }] };
}
