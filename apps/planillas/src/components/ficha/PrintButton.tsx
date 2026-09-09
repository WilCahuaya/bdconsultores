"use client";

export function PrintButton() {
  return (
    <button type="button" className="text-sm text-primary hover:underline" onClick={() => window.print()}>
      Imprimir
    </button>
  );
}
