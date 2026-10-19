"use client";

import type { ButtonHTMLAttributes, CSSProperties, DragEvent, InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";
import { forwardRef, useEffect, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        variant === "default" && "bg-primary text-primary-foreground hover:opacity-90",
        variant === "secondary" && "bg-secondary text-secondary-foreground hover:opacity-90",
        variant === "outline" && "border border-input bg-background hover:bg-accent",
        variant === "ghost" && "hover:bg-accent hover:text-accent-foreground",
        variant === "destructive" && "bg-destructive text-destructive-foreground hover:opacity-90",
        size === "default" && "h-10 px-4 py-2",
        size === "sm" && "h-9 px-3",
        size === "lg" && "h-11 px-8",
        className,
      )}
      {...props}
    />
  );
}

function shouldDisableSpellCheck({
  readOnly,
  type,
  inputMode,
}: Pick<InputHTMLAttributes<HTMLInputElement>, "readOnly" | "type" | "inputMode">) {
  return (
    readOnly ||
    type === "number" ||
    type === "email" ||
    type === "tel" ||
    type === "url" ||
    type === "search" ||
    inputMode === "numeric" ||
    inputMode === "decimal"
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  {
    className,
    spellCheck,
    readOnly,
    type,
    inputMode,
    lang,
    ...props
  },
  ref,
) {
  const resolvedSpellCheck = spellCheck ?? !shouldDisableSpellCheck({ readOnly, type, inputMode });
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
        "ring-offset-background placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      spellCheck={resolvedSpellCheck}
      lang={lang ?? (resolvedSpellCheck ? "es" : undefined)}
      readOnly={readOnly}
      type={type}
      inputMode={inputMode}
      {...props}
    />
  );
});

export function Textarea({
  className,
  spellCheck = true,
  lang = "es",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
        "ring-offset-background placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      spellCheck={spellCheck}
      lang={lang}
      {...props}
    />
  );
}

/** @deprecated Usa el componente Select; se mantiene por compatibilidad. */
export { nativeSelectClass, nativeSelectCompactClass, Select, type SelectOption } from "./select";
function FileUploadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 16V4m0 0-4 4m4-4 4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
      />
    </svg>
  );
}

function FileClearIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function FilePreviewIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
      />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function fileMatchesAccept(file: File, accept?: string): boolean {
  if (!accept?.trim()) return true;
  const parts = accept.split(",").map((part) => part.trim()).filter(Boolean);
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return parts.some((part) => {
    if (part.startsWith(".")) return name.endsWith(part.toLowerCase());
    if (part.endsWith("/*")) return type.startsWith(part.slice(0, -1).toLowerCase());
    return type === part.toLowerCase();
  });
}

export function FileInput({
  id,
  accept,
  disabled,
  className,
  file,
  onFileChange,
  buttonLabel = "Seleccionar",
  emptyLabel = "Ningún archivo seleccionado",
  hint,
  variant = "inline",
  dropzoneLabel = "Arrastre el archivo aquí",
  dropzoneHint = "o haga clic para seleccionarlo",
  onPreview,
  canPreview = false,
  previewLabel = "Previsualizar",
}: {
  id?: string;
  accept?: string;
  disabled?: boolean;
  className?: string;
  file?: File | null;
  onFileChange: (file: File | null) => void;
  buttonLabel?: string;
  emptyLabel?: string;
  hint?: string;
  variant?: "inline" | "dropzone";
  dropzoneLabel?: string;
  dropzoneHint?: string;
  /** Si se define y `canPreview`, muestra el icono de ojo. */
  onPreview?: () => void;
  canPreview?: boolean;
  previewLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [rejectHint, setRejectHint] = useState<string | null>(null);

  function applyFile(next: File | null) {
    setRejectHint(null);
    onFileChange(next);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] ?? null;
    if (picked && !fileMatchesAccept(picked, accept)) {
      setRejectHint("Tipo de archivo no permitido.");
      return;
    }
    applyFile(picked);
  }

  function handleClear() {
    applyFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    setDragActive(true);
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (disabled) return;

    const dropped = event.dataTransfer.files?.[0] ?? null;
    if (!dropped) return;
    if (!fileMatchesAccept(dropped, accept)) {
      setRejectHint("Tipo de archivo no permitido.");
      return;
    }
    applyFile(dropped);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (variant === "dropzone") {
    return (
      <div className="space-y-1">
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(event) => {
            if (disabled) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onClick={() => !disabled && inputRef.current?.click()}
          onDragEnter={handleDragOver}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative flex min-h-[8.5rem] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
            dragActive
              ? "border-primary bg-primary/10"
              : "border-border/70 bg-muted/20 hover:border-primary/50 hover:bg-muted/35",
            file && "border-solid border-primary/40 bg-primary/5",
            disabled && "cursor-not-allowed opacity-50",
            className,
          )}
        >
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept={accept}
            disabled={disabled}
            className="sr-only"
            onChange={handleChange}
          />
          <FileUploadIcon
            className={cn("h-8 w-8", dragActive || file ? "text-primary" : "text-muted-foreground")}
          />
          {file ? (
            <>
              <p className="max-w-full truncate text-sm font-medium text-foreground" title={file.name}>
                {file.name}
              </p>
              <p className="text-xs text-muted-foreground">Archivo listo para importar</p>
              {!disabled && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleClear();
                  }}
                  className="mt-1 text-xs font-medium text-primary hover:underline"
                >
                  Cambiar archivo
                </button>
              )}
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">{dropzoneLabel}</p>
              <p className="text-xs text-muted-foreground">{dropzoneHint}</p>
              <span className="mt-1 inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground">
                {buttonLabel}
              </span>
            </>
          )}
        </div>
        {(rejectHint || hint) && (
          <p className={cn("text-xs", rejectHint ? "text-destructive" : "text-muted-foreground")}>
            {rejectHint ?? hint}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-2",
          "ring-offset-background transition-shadow focus-within:ring-2 focus-within:ring-ring",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          disabled={disabled}
          className="sr-only"
          onChange={handleChange}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
            "bg-primary text-primary-foreground hover:opacity-90",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "disabled:pointer-events-none",
          )}
        >
          <FileUploadIcon className="h-3.5 w-3.5" />
          {buttonLabel}
        </button>
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm",
            file ? "font-medium text-foreground" : "text-muted-foreground",
          )}
          title={file?.name ?? emptyLabel}
        >
          {file?.name ?? emptyLabel}
        </span>
        {onPreview && (
          <button
            type="button"
            disabled={disabled || !canPreview}
            onClick={onPreview}
            className={cn(
              "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
              "text-muted-foreground hover:bg-muted hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:pointer-events-none disabled:opacity-40",
            )}
            aria-label={previewLabel}
            title={previewLabel}
          >
            <FilePreviewIcon className="h-3.5 w-3.5" />
          </button>
        )}
        {file && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Quitar archivo"
          >
            <FileClearIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-sm font-medium leading-none peer-disabled:opacity-70", className)}
      {...props}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-border/70 bg-card text-card-foreground shadow-sm", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex flex-col space-y-1.5 p-6", className)}>{children}</div>;
}

export function CardTitle({
  className,
  children,
  title,
}: {
  className?: string;
  children: ReactNode;
  title?: string;
}) {
  return (
    <h3 className={cn("text-2xl font-semibold leading-none tracking-tight", className)} title={title}>
      {children}
    </h3>
  );
}

export function CardDescription({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>;
}

export function CardContent({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("p-6 pt-0", className)}>{children}</div>;
}

function DialogCloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
  style,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.documentElement.classList.add("dialog-open");
    return () => {
      document.documentElement.classList.remove("dialog-open");
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="bd-dialog-overlay fixed inset-0 z-[300] flex items-end justify-center overflow-hidden bg-black/50 p-2 sm:items-center sm:p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        style={style}
        className={cn(
          "bd-dialog-panel flex max-h-[92vh] w-full min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-lg sm:max-h-[90vh]",
          className ?? "max-w-lg",
        )}
      >
        <div className="shrink-0 px-4 pb-2 pt-4 sm:px-6 sm:pb-3 sm:pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <h2 id="dialog-title" className="text-lg font-semibold">
                {title}
              </h2>
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
            <button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Cerrar"
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const tragarClic = (siguiente: Event) => {
                  siguiente.preventDefault();
                  siguiente.stopPropagation();
                };
                document.addEventListener("click", tragarClic, true);
                onClose();
                window.setTimeout(() => document.removeEventListener("click", tragarClic, true), 150);
              }}
            >
              <DialogCloseIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="scrollbar-none flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-4 sm:px-6 sm:pb-6">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export { cn };
export { Tooltip } from "./tooltip";
