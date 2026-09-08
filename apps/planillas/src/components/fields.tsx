const fieldClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  readOnly,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number | null;
  required?: boolean;
  readOnly?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        className={fieldClass}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        required={required}
        readOnly={readOnly}
        disabled={readOnly}
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

export { fieldClass };
