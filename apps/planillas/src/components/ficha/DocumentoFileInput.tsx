"use client";

import { useState, type ComponentProps } from "react";
import { FileInput, useToast } from "@inventario/ui";
import { archivoParaGuardar } from "@/lib/convertir-a-pdf";

export function DocumentoFileInput({
  disabled,
  buttonLabel,
  onFileChange,
  ...props
}: ComponentProps<typeof FileInput>) {
  const { pushToast } = useToast();
  const [convirtiendo, setConvirtiendo] = useState(false);

  function elegir(file: File | null) {
    if (!file) {
      onFileChange(null);
      return;
    }
    setConvirtiendo(true);
    void archivoParaGuardar(file).then((result) => {
      setConvirtiendo(false);
      if (result.error || !result.file) {
        pushToast(result.error ?? "No se pudo convertir el archivo a PDF.", "error");
        return;
      }
      onFileChange(result.file);
    });
  }

  return (
    <FileInput
      {...props}
      disabled={disabled || convirtiendo}
      buttonLabel={convirtiendo ? "Convirtiendo a PDF…" : buttonLabel}
      onFileChange={elegir}
    />
  );
}
