"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@inventario/ui";
import { aceptarAltaTrabajador } from "@/lib/actions/trabajadores";

export function AceptarAltaButton({ relacionId }: { relacionId: string }) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);

  async function onAccept() {
    setPending(true);
    const result = await aceptarAltaTrabajador(relacionId);
    setPending(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    pushToast("Alta aceptada.");
    router.refresh();
  }

  return (
    <Button type="button" onClick={() => void onAccept()} disabled={pending}>
      {pending ? "Aceptando…" : "Aceptar alta"}
    </Button>
  );
}
