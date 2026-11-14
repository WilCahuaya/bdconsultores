"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CATALOGO_CUENTA_ORDEN_CONTABILIDAD,
  CATALOGO_CUENTA_ORDEN_ESTADO,
  type CatalogoCampoOpciones,
  type CatalogoOpcionTipo,
  type CreateCatalogoNacionalInput,
  type CuentaContable,
  type UpsertCuentaContableInput,
  validarCuentaContableParaCatalogo,
} from "@inventario/types";
import { Button, Input, Label } from "./components";
import { ClaseCatalogoCombobox } from "./clase-catalogo-combobox";
import { CuentaContableFields } from "./cuenta-contable-fields";
import { GrupoCatalogoCombobox } from "./grupo-catalogo-combobox";
import { PorcentajeInput } from "./porcentaje-input";

export type CatalogoNacionalFormVariant = "propio" | "nacional";

export interface CatalogoNacionalFormProps {
  variant?: CatalogoNacionalFormVariant;
  initialDenominacion?: string;
  initialCodigo?: string;
  codigo: string;
  codigoEditable?: boolean;
  codigoLoading?: boolean;
  grupos?: CatalogoCampoOpciones;
  clases?: CatalogoCampoOpciones;
  gruposLoading?: boolean;
  clasesLoading?: boolean;
  pending?: boolean;
  searchCuentasContables: (query: string) => Promise<CuentaContable[]>;
  onSuggestGrupo?: (denominacion: string) => Promise<string | null>;
  onSuggestClase?: (denominacion: string) => Promise<string | null>;
  onRegisterOpcionPersonalizada?: (
    tipo: CatalogoOpcionTipo,
    valor: string,
  ) => void | Promise<void | { error?: string }>;
  onDeleteOpcionPersonalizada?: (
    tipo: CatalogoOpcionTipo,
    valor: string,
  ) => void | Promise<{ error?: string } | void>;
  onOpcionesChanged?: () => void | Promise<void>;
  onSubmit: (input: CreateCatalogoNacionalInput) => void | Promise<void>;
  onCreateCuentaContable?: (
    input: UpsertCuentaContableInput,
  ) => Promise<{ data?: CuentaContable; error?: string }>;
}

export function CatalogoNacionalForm({
  variant = "propio",
  initialDenominacion = "",
  initialCodigo = "",
  codigo: codigoProp,
  codigoEditable = false,
  codigoLoading = false,
  grupos = { opciones: [], personalizadas: [] },
  clases = { opciones: [], personalizadas: [] },
  gruposLoading = false,
  clasesLoading = false,
  pending = false,
  searchCuentasContables,
  onSuggestGrupo,
  onSuggestClase,
  onRegisterOpcionPersonalizada,
  onDeleteOpcionPersonalizada,
  onOpcionesChanged,
  onSubmit,
  onCreateCuentaContable,
}: CatalogoNacionalFormProps) {
  const esNacional = variant === "nacional";
  const [denominacion, setDenominacion] = useState(initialDenominacion);
  const [codigoEditableValue, setCodigoEditableValue] = useState(initialCodigo || codigoProp);
  const [grupo, setGrupo] = useState("");
  const [clase, setClase] = useState("");
  const [cuentaCodigo, setCuentaCodigo] = useState(
    esNacional ? "" : CATALOGO_CUENTA_ORDEN_CONTABILIDAD,
  );
  const [contabilidad, setContabilidad] = useState("");
  const [depreciacion, setDepreciacion] = useState("");
  const [resolucion, setResolucion] = useState("");
  const [cuentaError, setCuentaError] = useState<string | null>(null);
  const [codigosCuentaMaestra, setCodigosCuentaMaestra] = useState<string[]>([]);
  const [grupoSugerido, setGrupoSugerido] = useState<string | null>(null);
  const [claseSugerida, setClaseSugerida] = useState<string | null>(null);
  const [grupoManual, setGrupoManual] = useState(false);
  const [claseManual, setClaseManual] = useState(false);
  const [sugiriendoGrupo, setSugiriendoGrupo] = useState(false);
  const [sugiriendoClase, setSugiriendoClase] = useState(false);
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const grupoManualRef = useRef(false);
  const claseManualRef = useRef(false);
  const onSuggestGrupoRef = useRef(onSuggestGrupo);
  const onSuggestClaseRef = useRef(onSuggestClase);
  const clasesOpcionesRef = useRef(clases.opciones);
  onSuggestGrupoRef.current = onSuggestGrupo;
  onSuggestClaseRef.current = onSuggestClase;
  clasesOpcionesRef.current = clases.opciones;

  const gruposDisponibles = useMemo(() => {
    const merged = new Set(grupos.opciones);
    if (grupo) merged.add(grupo);
    return [...merged].sort((a, b) => a.localeCompare(b, "es"));
  }, [grupos.opciones, grupo]);

  const clasesDisponibles = useMemo(() => {
    const merged = new Set(clases.opciones);
    if (clase) merged.add(clase);
    return [...merged].sort((a, b) => a.localeCompare(b, "es"));
  }, [clases.opciones, clase]);

  function setGrupoManualState(manual: boolean) {
    grupoManualRef.current = manual;
    setGrupoManual(manual);
  }

  function setClaseManualState(manual: boolean) {
    claseManualRef.current = manual;
    setClaseManual(manual);
  }

  useEffect(() => {
    setDenominacion(initialDenominacion);
    setGrupo("");
    setClase("");
    setCuentaCodigo(esNacional ? "" : CATALOGO_CUENTA_ORDEN_CONTABILIDAD);
    setContabilidad("");
    setDepreciacion("");
    setResolucion("");
    setCuentaError(null);
    setGrupoSugerido(null);
    setClaseSugerida(null);
    setGrupoManualState(false);
    setClaseManualState(false);
  }, [initialDenominacion, codigoProp, esNacional]);

  useEffect(() => {
    const texto = denominacion.trim();
    const buscarGrupo = !grupoManual && Boolean(onSuggestGrupoRef.current);
    const buscarClase = !claseManual && Boolean(onSuggestClaseRef.current);

    if (texto.length < 2 || (!buscarGrupo && !buscarClase)) {
      setSugiriendoGrupo(false);
      setSugiriendoClase(false);
      return;
    }

    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    setSugiriendoGrupo(buscarGrupo);
    setSugiriendoClase(buscarClase);

    suggestTimerRef.current = setTimeout(() => {
      void (async () => {
        const [sugeridoGrupo, sugeridoClase] = await Promise.all([
          buscarGrupo && onSuggestGrupoRef.current
            ? onSuggestGrupoRef.current(texto)
            : Promise.resolve(null),
          buscarClase && onSuggestClaseRef.current
            ? onSuggestClaseRef.current(texto)
            : Promise.resolve(null),
        ]);

        setSugiriendoGrupo(false);
        setSugiriendoClase(false);

        if (!grupoManualRef.current && buscarGrupo) {
          setGrupoSugerido(sugeridoGrupo);
          if (sugeridoGrupo) setGrupo(sugeridoGrupo);
        }
        if (!claseManualRef.current && buscarClase) {
          const aplicable =
            sugeridoClase && clasesOpcionesRef.current.includes(sugeridoClase)
              ? sugeridoClase
              : null;
          setClaseSugerida(aplicable);
          if (aplicable) setClase(aplicable);
        }
      })();
    }, 350);

    return () => {
      if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    };
  }, [denominacion, grupoManual, claseManual, clases.opciones]);

  function handleDenominacionChange(value: string) {
    setDenominacion(value);
    setGrupoManualState(false);
    setClaseManualState(false);
    setGrupoSugerido(null);
    setClaseSugerida(null);
  }

  function handleGrupoChange(value: string) {
    setGrupo(value);
    setGrupoManualState(Boolean(value));
    if (value && value !== grupoSugerido) setGrupoSugerido(null);
  }

  function handleClaseChange(value: string) {
    setClase(value);
    setClaseManualState(Boolean(value));
    if (value && value !== claseSugerida) setClaseSugerida(null);
  }

  async function handleRegister(tipo: CatalogoOpcionTipo, valor: string) {
    await onRegisterOpcionPersonalizada?.(tipo, valor);
    await onOpcionesChanged?.();
  }

  async function handleDelete(tipo: CatalogoOpcionTipo, valor: string) {
    const result = await onDeleteOpcionPersonalizada?.(tipo, valor);
    await onOpcionesChanged?.();
    return result;
  }

  const camposDeshabilitados = pending || (!esNacional && codigoLoading);
  const codigo = esNacional || codigoEditable ? codigoEditableValue : codigoProp;

  useEffect(() => {
    if (!esNacional && !codigoEditable) return;
    if (initialCodigo) setCodigoEditableValue(initialCodigo);
  }, [initialCodigo, esNacional, codigoEditable]);

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (esNacional) {
          const err = validarCuentaContableParaCatalogo(cuentaCodigo, contabilidad, {
            codigosEnMaestra: codigosCuentaMaestra,
          });
          if (err) {
            setCuentaError(err);
            return;
          }
        }
        setCuentaError(null);
        void onSubmit({
          codigo,
          denominacion,
          grupo,
          clase,
          cuenta_codigo: esNacional ? cuentaCodigo : undefined,
          contabilidad: esNacional ? contabilidad : undefined,
          depreciacion: esNacional ? depreciacion : undefined,
          resolucion: esNacional ? resolucion : undefined,
          estado: esNacional ? "ACTIVO" : CATALOGO_CUENTA_ORDEN_ESTADO,
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="catalogo_codigo">Código</Label>
        {esNacional || codigoEditable ? (
          <Input
            id="catalogo_codigo"
            required
            inputMode="numeric"
            pattern="\d{8}"
            maxLength={8}
            value={codigoEditableValue}
            disabled={camposDeshabilitados}
            className="font-mono"
            placeholder="12345678"
            onChange={(e) => setCodigoEditableValue(e.target.value.replace(/\D/g, "").slice(0, 8))}
          />
        ) : (
          <Input
            id="catalogo_codigo"
            readOnly
            disabled
            value={codigoLoading ? "Generando…" : codigoProp}
            className="bg-muted font-mono"
          />
        )}
        <p className="text-xs text-muted-foreground">
          {esNacional
            ? "Código de 8 dígitos del catálogo nacional SBN."
            : "Secuencia automática para bienes de cuenta de orden (BD000001, BD000002…)."}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="catalogo_denominacion">Denominación</Label>
        <Input
          id="catalogo_denominacion"
          required
          value={denominacion}
          disabled={camposDeshabilitados}
          placeholder="CUCHARA DE COCINA"
          onChange={(e) => handleDenominacionChange(e.target.value)}
        />
      </div>

      {esNacional ? (
        <>
          <CuentaContableFields
            codigo={cuentaCodigo}
            nombre={contabilidad}
            onCodigoChange={(value) => {
              setCuentaCodigo(value);
              setCuentaError(null);
            }}
            onNombreChange={(value) => {
              setContabilidad(value);
              setCuentaError(null);
            }}
            searchCuentas={searchCuentasContables}
            disabled={camposDeshabilitados}
            codigoId="catalogo_cuenta_codigo"
            nombreId="catalogo_contabilidad"
            allowCreateNew={Boolean(onCreateCuentaContable)}
            onCreateCuenta={onCreateCuentaContable}
            onCodigosMaestraLoaded={setCodigosCuentaMaestra}
          />
          {cuentaError && (
            <p className="text-sm text-destructive sm:col-span-2">{cuentaError}</p>
          )}
        </>
      ) : null}

      {esNacional && (
        <div className="space-y-2">
          <Label htmlFor="catalogo_depreciacion">% Depreciación</Label>
          <PorcentajeInput
            id="catalogo_depreciacion"
            value={depreciacion}
            onChange={setDepreciacion}
            disabled={camposDeshabilitados}
            placeholder="Ej. 10 %"
          />
        </div>
      )}

      <div>
        <ClaseCatalogoCombobox
          id="catalogo_clase"
          value={clase}
          opciones={clasesDisponibles}
          personalizadas={clases.personalizadas}
          disabled={camposDeshabilitados || clasesLoading}
          loading={clasesLoading}
          suggestedClase={claseSugerida}
          onChange={handleClaseChange}
          helperText={
            sugiriendoClase
              ? "Buscando clase recomendada según la denominación…"
              : undefined
          }
          onRegisterPersonalizada={(valor) => handleRegister("clase", valor)}
          onDeletePersonalizada={(valor) => handleDelete("clase", valor)}
        />
      </div>

      <div>
        <GrupoCatalogoCombobox
          id="catalogo_grupo"
          value={grupo}
          grupos={gruposDisponibles}
          personalizadas={grupos.personalizadas}
          disabled={camposDeshabilitados}
          loading={gruposLoading}
          suggestedGrupo={grupoSugerido}
          onChange={handleGrupoChange}
          onRegisterPersonalizada={(valor) => handleRegister("grupo", valor)}
          onDeletePersonalizada={(valor) => handleDelete("grupo", valor)}
          helperText={
            sugiriendoGrupo
              ? "Buscando grupo recomendado según la denominación…"
              : undefined
          }
        />
      </div>

      {esNacional && (
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="catalogo_resolucion">Resolución</Label>
          <Input
            id="catalogo_resolucion"
            value={resolucion}
            disabled={camposDeshabilitados}
            placeholder="Ej. R.D. N.º 123-2020-EF"
            onChange={(e) => setResolucion(e.target.value)}
          />
        </div>
      )}

      <div className="sm:col-span-2">
        <Button
          type="submit"
          disabled={camposDeshabilitados || !codigo || !grupo || !clase}
        >
          {pending ? "Guardando…" : "Agregar al catálogo"}
        </Button>
      </div>
    </form>
  );
}
