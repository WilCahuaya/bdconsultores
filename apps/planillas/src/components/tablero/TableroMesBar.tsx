"use client";

import { useRouter } from "next/navigation";

export function TableroMesBar({ mes }: { mes: string }) {
  const router = useRouter();
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">Mes</span>
      <input
        type="month"
        value={mes}
        onChange={(event) => router.push(`/tablero?mes=${event.target.value}`)}
        className="flex h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
      />
    </label>
  );
}
