"use client";

import { useRouter } from "next/navigation";

export function MostrarBajasCheck({
  entidadId,
  checked,
}: {
  entidadId: string;
  checked: boolean;
}) {
  const router = useRouter();

  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-input"
        checked={checked}
        onChange={(event) => {
          const query = new URLSearchParams();
          if (entidadId) query.set("entidadId", entidadId);
          if (event.target.checked) query.set("bajas", "1");
          router.push(`/?${query.toString()}`);
        }}
      />
      Mostrar bajas
    </label>
  );
}
