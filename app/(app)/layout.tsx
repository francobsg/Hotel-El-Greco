import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { requirePage } from "@/lib/auth";

export default async function LayoutAplicacion({ children }: { children: ReactNode }) {
  const usuario = await requirePage();
  return <AppShell usuario={usuario}>{children}</AppShell>;
}
