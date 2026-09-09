"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import { consultarRuc, createEntidadPlanillas } from "@/lib/actions/entidades";
import { Field } from "@/components/fields";

export function NuevaEmpresaForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [ruc, setRuc] = useState("");
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");

  async function buscarPorRuc() {
    setBuscando(true);
    setError(null);
    setLookupMsg(null);
    const result = await consultarRuc(ruc);
    setBuscando(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.ruc) setRuc(result.ruc);
    if (result.nombre) setNombre(result.nombre);
    if (result.direccion) setDireccion(result.direccion);
    setLookupMsg(
      result.estado ? `Padrón SUNAT: ${result.estado}. Puede editar los datos si hace falta.` : "Datos traídos del padrón. Puede editarlos si hace falta.",
    );
  }

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createEntidadPlanillas(formData);
    setPending(false);
    if (result.error || !result.entidadId) {
      setError(result.error ?? "No se pudo crear la empresa.");
      return;
    }
    const aviso = result.inviteMessage ? `&aviso=${encodeURIComponent(result.inviteMessage)}` : "";
    router.push(`/?entidadId=${result.entidadId}${aviso}`);
  }

  return (
    <form action={onSubmit} className={`${panelCardClass} space-y-5 p-5`}>
      <p className="text-sm text-muted-foreground">
        Con el RUC se puede traer razón social y dirección del padrón. El administrador se registra como primer
        trabajador y recibe invitación para entrar con Google.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Field
            label="RUC"
            name="ruc"
            placeholder="20XXXXXXXXX"
            inputMode="numeric"
            maxLength={11}
            pattern="[0-9]{11}"
            title="11 dígitos"
            value={ruc}
            onChange={(event) => setRuc(event.target.value.replace(/\D/g, "").slice(0, 11))}
          />
          <Button type="button" variant="outline" size="sm" disabled={buscando || pending} onClick={() => void buscarPorRuc()}>
            {buscando ? "Consultando…" : "Buscar en SUNAT"}
          </Button>
        </div>
        <Field
          label="Razón social"
          name="nombre"
          required
          value={nombre}
          onChange={(event) => setNombre(event.target.value)}
        />
        <div className="sm:col-span-2">
          <Field
            label="Dirección"
            name="direccion"
            value={direccion}
            onChange={(event) => setDireccion(event.target.value)}
          />
        </div>
      </div>
      {lookupMsg ? <p className="text-sm text-muted-foreground">{lookupMsg}</p> : null}
      <p className="text-sm font-medium">Administrador de la empresa</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" name="admin_nombre" required />
        <Field
          label="DNI"
          name="admin_dni"
          required
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          pattern="[0-9]{8}"
          title="8 dígitos"
          placeholder="12345678"
        />
        <Field label="Correo" name="admin_email" type="email" required />
        <Field label="Teléfono" name="admin_telefono" inputMode="tel" />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="usa_inventarios" className="mt-1" />
        <span>
          También usa Inventarios
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Si no lo marca, la empresa no aparece en el módulo de activos.
          </span>
        </span>
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending || buscando}>
        {pending ? "Guardando…" : "Crear empresa"}
      </Button>
    </form>
  );
}
