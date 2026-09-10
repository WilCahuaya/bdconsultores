"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@inventario/ui";

export function PlanillasToastProvider({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
