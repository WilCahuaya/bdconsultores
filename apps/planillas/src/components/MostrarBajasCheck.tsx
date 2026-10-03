"use client";

export function MostrarBajasCheck({
  entidadId,
  checked,
  onCheckedChange,
}: {
  entidadId: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap text-sm">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-input"
        checked={checked}
        onChange={(event) => {
          const next = event.target.checked;
          onCheckedChange(next);
          const url = new URL(window.location.href);
          if (entidadId) url.searchParams.set("entidadId", entidadId);
          if (next) url.searchParams.set("bajas", "1");
          else url.searchParams.delete("bajas");
          window.history.replaceState(window.history.state, "", url);
        }}
      />
      Mostrar bajas
    </label>
  );
}
