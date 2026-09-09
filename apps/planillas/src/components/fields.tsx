"use client";

import { useState, type ChangeEvent, type ReactNode } from "react";
import { FechaDdMmYyyyInput } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import { formatFechaInputDDMMYYYY, formatFechaISOToDDMMYYYY } from "@inventario/types";

const fieldClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function toDdMmYyyy(value: string | number | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return formatFechaISOToDDMMYYYY(iso[0]);
  return formatFechaInputDDMMYYYY(raw);
}

export function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  readOnly,
  inputMode,
  maxLength,
  pattern,
  placeholder,
  autoComplete,
  title,
  value,
  onChange,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number | null;
  required?: boolean;
  readOnly?: boolean;
  inputMode?: "text" | "numeric" | "tel" | "email";
  maxLength?: number;
  pattern?: string;
  placeholder?: string;
  autoComplete?: string;
  title?: string;
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        className={fieldClass}
        name={name}
        type={type}
        {...(value === undefined ? { defaultValue: defaultValue ?? "" } : { value, onChange })}
        required={required}
        readOnly={readOnly}
        disabled={readOnly}
        inputMode={inputMode}
        maxLength={maxLength}
        pattern={pattern}
        placeholder={placeholder}
        autoComplete={autoComplete}
        title={title}
      />
    </label>
  );
}

export function DateField({
  label,
  name,
  defaultValue,
  required,
  readOnly,
  value,
  onChange,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  required?: boolean;
  readOnly?: boolean;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const [inner, setInner] = useState(() => toDdMmYyyy(value ?? defaultValue));
  const display = value !== undefined ? toDdMmYyyy(value) : inner;

  function handleChange(next: string) {
    if (value === undefined) setInner(next);
    onChange?.(next);
  }

  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <FechaDdMmYyyyInput
        name={name}
        value={display}
        onChange={handleChange}
        required={required}
        readOnly={readOnly}
        disabled={readOnly}
        placeholder="DD/MM/AAAA"
        title="Escriba o pegue la fecha: DD/MM/AAAA"
        className={fieldClass}
      />
    </label>
  );
}

export function SelectField({
  label,
  name,
  defaultValue,
  options,
  required,
  disabled,
  allowEmpty,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  options: { value: string; label: string }[];
  required?: boolean;
  disabled?: boolean;
  allowEmpty?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <select
        className={fieldClass}
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        disabled={disabled}
      >
        {allowEmpty ? <option value="">—</option> : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FormSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className={`${panelCardClass} space-y-4 p-5`}>
      <div>
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

export { fieldClass };
