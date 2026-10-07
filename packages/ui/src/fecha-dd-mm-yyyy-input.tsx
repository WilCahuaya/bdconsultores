"use client";

import { useRef, type InputHTMLAttributes } from "react";
import { completarFechaInputDDMMYYYY, formatFechaInputDDMMYYYY } from "@inventario/types";
import { Input } from "./components";

/** Posición del cursor tras N dígitos en el texto formateado DD/MM/AAAA. */
function cursorAfterDigitCount(formatted: string, digitCount: number): number {
  if (!formatted) return 0;
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]!)) {
      seen++;
      if (seen >= digitCount) return i + 1;
    }
  }
  return formatted.length;
}

export type FechaDdMmYyyyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange"
> & {
  value: string;
  onChange: (value: string) => void;
};

export function FechaDdMmYyyyInput({
  value,
  onChange,
  className,
  disabled,
  id,
  placeholder = "DD/MM/AAAA",
  onBlur,
  ...rest
}: FechaDdMmYyyyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const el = e.target;
    const raw = el.value;
    const cursor = el.selectionStart ?? raw.length;
    // Contar dígitos del valor crudo (antes del formateo), no del valor anterior controlado.
    const digitsBeforeCursor = raw.slice(0, cursor).replace(/\D/g, "").length;
    const next = formatFechaInputDDMMYYYY(raw);
    onChange(next);
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      const pos = cursorAfterDigitCount(next, digitsBeforeCursor);
      input.setSelectionRange(pos, pos);
    });
  }

  return (
    <Input
      {...rest}
      ref={inputRef}
      id={id}
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      maxLength={10}
      autoComplete="off"
      spellCheck={false}
      value={value}
      disabled={disabled}
      className={className}
      onChange={handleChange}
      onBlur={(event) => {
        const completo = completarFechaInputDDMMYYYY(value);
        if (completo !== value) onChange(completo);
        onBlur?.(event);
      }}
    />
  );
}
