"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@inventario/ui";
import { aceptarAltaTrabajador } from "@/lib/actions/trabajadores";

export function AceptarAltaButton({ relacionId }: { relacionId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onAccept() {
    setPending(true);
    setError(null);
    const result = await aceptarAltaTrabajador(relacionId);
    setPending(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="space-y-2">
      <Button type="button" onClick={() => void onAccept()} disabled={pending}>
        {pending ? "Aceptando…" : "Aceptar alta"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
