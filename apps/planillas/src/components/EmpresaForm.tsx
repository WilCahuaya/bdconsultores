"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@inventario/ui";
import type { Entidad } from "@inventario/types";
import { consultarDni, consultarRuc, createEntidadPlanillas, updateEntidadPlanillas } from "@/lib/actions/entidades";
import { Field, FormSection } from "@/components/fields";

export function EmpresaForm({ entidad }: { entidad?: Entidad }) {
  const router = useRouter();
  const { pushToast } = useToast();
  const isEdit = Boolean(entidad);
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [buscandoDni, setBuscandoDni] = useState(false);
  const [ruc, setRuc] = useState(entidad?.ruc ?? "");
  const [nombre, setNombre] = useState(entidad?.nombre ?? "");
  const [direccion, setDireccion] = useState(entidad?.direccion ?? "");
  const [adminDni, setAdminDni] = useState(entidad?.admin_dni ?? "");
  const [adminNombre, setAdminNombre] = useState(entidad?.admin_nombre ?? "");
  const [dniMsg, setDniMsg] = useState<string | null>(null);
  const [rlDni, setRlDni] = useState(entidad?.representante_legal_dni ?? "");
  const [rlNombre, setRlNombre] = useState(entidad?.representante_legal_nombre ?? "");
  const [rlCargo, setRlCargo] = useState(entidad?.representante_legal_cargo ?? "");
  const [buscandoRl, setBuscandoRl] = useState(false);
  const [rlMsg, setRlMsg] = useState<string | null>(null);

  async function buscarPorRuc() {
    setBuscando(true);
    setLookupMsg(null);
    const result = await consultarRuc(ruc);
    setBuscando(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    if (result.ruc) setRuc(result.ruc);
    if (result.nombre) setNombre(result.nombre);
    if (result.direccion) setDireccion(result.direccion);
    setLookupMsg(
      result.estado ? `Padrón SUNAT: ${result.estado}. Puede editar los datos si hace falta.` : "Datos traídos del padrón. Puede editarlos si hace falta.",
    );
  }

  async function buscarPorDni() {
    setBuscandoDni(true);
    setDniMsg(null);
    const result = await consultarDni(adminDni);
    setBuscandoDni(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    if (result.dni) setAdminDni(result.dni);
    if (result.nombre_completo) setAdminNombre(result.nombre_completo);
    setDniMsg("Datos traídos del padrón RENIEC. Puede editarlos si hace falta.");
  }

  async function buscarRepresentantePorDni() {
    setBuscandoRl(true);
    setRlMsg(null);
    const result = await consultarDni(rlDni);
    setBuscandoRl(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    if (result.dni) setRlDni(result.dni);
    if (result.nombre_completo) setRlNombre(result.nombre_completo);
    setRlMsg("Nombre traído del padrón RENIEC. El cargo se toma de la ficha RUC de SUNAT.");
  }

  async function onSubmit(formData: FormData) {
    setPending(true);
    const result = isEdit && entidad
      ? await updateEntidadPlanillas(entidad.id, formData)
      : await createEntidadPlanillas(formData);
    setPending(false);
    if (result.error || !result.entidadId) {
      pushToast(result.error ?? (isEdit ? "No se pudo guardar la empresa." : "No se pudo crear la empresa."), "error");
      return;
    }
    pushToast(isEdit ? "Empresa guardada." : "Empresa creada.");
    const aviso = result.inviteMessage ? `&aviso=${encodeURIComponent(result.inviteMessage)}` : "";
    router.push(`/?entidadId=${result.entidadId}${aviso}`);
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <FormSection
        title="Empresa"
        hint="Con el RUC se puede traer razón social y dirección del padrón."
      >
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
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="usa_inventarios"
            className="mt-1"
            defaultChecked={entidad ? entidad.usa_inventarios !== false : false}
          />
          <span>
            También usa Inventarios
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Si no lo marca, la empresa no aparece en el módulo de activos.
            </span>
          </span>
        </label>
      </FormSection>
      <FormSection
        title="Representante legal (SUNAT)"
        hint="No es el administrador de la plataforma. Es quien figura como representante legal en la ficha RUC."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Field
              label="DNI"
              name="representante_legal_dni"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              pattern="[0-9]{8}"
              title="8 dígitos"
              placeholder="12345678"
              value={rlDni}
              onChange={(event) => setRlDni(event.target.value.replace(/\D/g, "").slice(0, 8))}
            />
            <Button type="button" variant="outline" size="sm" disabled={buscandoRl || pending} onClick={() => void buscarRepresentantePorDni()}>
              {buscandoRl ? "Consultando…" : "Buscar en RENIEC"}
            </Button>
          </div>
          <Field
            label="Nombre"
            name="representante_legal_nombre"
            value={rlNombre}
            onChange={(event) => setRlNombre(event.target.value)}
          />
          <div className="sm:col-span-2">
            <Field
              label="Cargo en SUNAT"
              name="representante_legal_cargo"
              placeholder="Ej. Gerente general, titular"
              value={rlCargo}
              onChange={(event) => setRlCargo(event.target.value)}
            />
          </div>
        </div>
        {rlMsg ? <p className="text-sm text-muted-foreground">{rlMsg}</p> : null}
      </FormSection>
      <FormSection
        title="Administrador de la empresa"
        hint={
          isEdit
            ? "Si cambia el correo, se envía una nueva invitación. El administrador sigue figurando como trabajador."
            : "Se registra como primer trabajador y recibe invitación para entrar con Google."
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
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
              value={adminDni}
              onChange={(event) => setAdminDni(event.target.value.replace(/\D/g, "").slice(0, 8))}
            />
            <Button type="button" variant="outline" size="sm" disabled={buscandoDni || pending} onClick={() => void buscarPorDni()}>
              {buscandoDni ? "Consultando…" : "Buscar en RENIEC"}
            </Button>
          </div>
          <Field
            label="Nombre"
            name="admin_nombre"
            required
            value={adminNombre}
            onChange={(event) => setAdminNombre(event.target.value)}
          />
          <Field label="Correo" name="admin_email" type="email" required defaultValue={entidad?.admin_email ?? ""} />
          <Field label="Teléfono" name="admin_telefono" inputMode="tel" defaultValue={entidad?.admin_telefono ?? ""} />
        </div>
        {dniMsg ? <p className="text-sm text-muted-foreground">{dniMsg}</p> : null}
      </FormSection>
      <Button type="submit" disabled={pending || buscando || buscandoDni || buscandoRl}>
        {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear empresa"}
      </Button>
    </form>
  );
}
