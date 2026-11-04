import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { InstalarPwa } from "@/components/layout/InstalarPwa";
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0F3D2E" };

export const metadata: Metadata = {
  title: {
    default: "Hotel Museo El Greco | Inventario",
    template: "%s | Hotel Museo El Greco",
  },
  description: "Sistema de inventario del Hotel Museo El Greco.",
  appleWebApp: { capable: true, title: "El Greco", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-CL">
      <body><InstalarPwa />{children}</body>
    </html>
  );
}
