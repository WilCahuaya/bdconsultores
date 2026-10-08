"use client";

import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CatalogoNacional } from "@inventario/types";
import {
  CATALOGO_SEARCH_MAX_RESULTS,
  isCatalogoPropio,
  minCatalogoQueryLength,
} from "@inventario/types";
import { computeFloatingMenuLayout, type FloatingMenuLayout } from "./dropdown-position";
import { cn, Input, Label } from "./components";

export type CatalogoPickerVariant = "nacional" | "propio" | "ambos";

const CATALOGO_PICKER_COPY: Record<
  CatalogoPickerVariant,
  { label: string; hint: string; placeholder: string; empty: string }
> = {
  nacional: {
    label: "Código catálogo nacional",
    hint: "Escriba código o denominación del catálogo.",
    placeholder: "Buscar por código o denominación…",
    empty: "Sin coincidencias en el catálogo nacional.",
  },
  propio: {
    label: "Código catálogo propio",
    hint: "Escriba código o denominación del catálogo.",
    placeholder: "Buscar por código o denominación…",
    empty: "Sin coincidencias en el catálogo propio.",
  },
  ambos: {
    label: "Código catálogo",
    hint: "Busque en catálogo nacional o propio por código o denominación.",
    placeholder: "Buscar por código o denominación…",
    empty: "Sin coincidencias en catálogo nacional ni propio.",
  },
};

export interface CatalogoPickerProps {
  onSelect: (item: CatalogoNacional) => void;
  onClear?: () => void;
  selectedCodigo?: string;
  selectedDenominacion?: string;
  disabled?: boolean;
  /** Nacional (SBN), propio (BD…) o ambos (secciones). Cambia título y mensajes. */
  variant?: CatalogoPickerVariant;
  searchCatalogo: (query: string, limit?: number) => Promise<CatalogoNacional[]>;
  resolveCodigo?: (codigo: string) => Promise<CatalogoNacional | null>;
  renderAddMissing?: (query: string) => ReactNode;
}

function looksLikeCatalogoCodigo(trimmed: string, variant: CatalogoPickerVariant): boolean {
  if (variant === "propio") {
    return /^BD\d{1,6}$/i.test(trimmed) || /^\d{1,8}$/.test(trimmed);
  }
  if (variant === "ambos") {
    return /^BD\d{1,6}$/i.test(trimmed) || /^\d{1,12}$/.test(trimmed);
  }
  return /^\d{1,12}$/.test(trimmed);
}

function CatalogoResultButton({
  item,
  active,
  optionId,
  onSelect,
  onHover,
}: {
  item: CatalogoNacional;
  active: boolean;
  optionId: string;
  onSelect: (item: CatalogoNacional) => void;
  onHover: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!active || !buttonRef.current) return;
    const item = buttonRef.current;
    const list = item.closest("ul");
    if (!list) return;
    const itemTop = item.offsetTop;
    const itemBottom = itemTop + item.offsetHeight;
    if (itemTop < list.scrollTop) {
      list.scrollTop = itemTop;
    } else if (itemBottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = itemBottom - list.clientHeight;
    }
  }, [active]);

  return (
    <button
      ref={buttonRef}
      id={optionId}
      type="button"
      role="option"
      aria-selected={active}
      className={cn(
        "w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground",
        active && "bg-accent text-accent-foreground",
      )}
      onMouseDown={(event) => event.preventDefault()}
      onMouseEnter={onHover}
      onClick={() => onSelect(item)}
    >
      <span className="font-mono font-medium text-primary">{item.codigo}</span>
      <span className="ml-2">{item.denominacion}</span>
      {item.clase && (
        <span className="mt-0.5 block text-xs text-muted-foreground">{item.clase}</span>
      )}
    </button>
  );
}

export function CatalogoPicker({
  onSelect,
  onClear,
  selectedCodigo,
  selectedDenominacion,
  disabled,
  variant = "nacional",
  searchCatalogo,
  resolveCodigo,
  renderAddMissing,
}: CatalogoPickerProps) {
  const copy = CATALOGO_PICKER_COPY[variant];
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogoNacional[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [menuLayout, setMenuLayout] = useState<FloatingMenuLayout | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const onSelectRef = useRef(onSelect);
  const searchCatalogoRef = useRef(searchCatalogo);
  const resolveCodigoRef = useRef(resolveCodigo);
  const pickingRef = useRef(false);

  onSelectRef.current = onSelect;
  searchCatalogoRef.current = searchCatalogo;
  resolveCodigoRef.current = resolveCodigo;

  const groupedResults = useMemo(() => {
    if (variant !== "ambos") {
      return { nacional: results, propio: [] as CatalogoNacional[] };
    }
    const nacional: CatalogoNacional[] = [];
    const propio: CatalogoNacional[] = [];
    for (const item of results) {
      if (isCatalogoPropio(item)) propio.push(item);
      else nacional.push(item);
    }
    return { nacional, propio };
  }, [results, variant]);

  const selectableItems = useMemo(() => {
    if (variant !== "ambos") return results;
    return [...groupedResults.nacional, ...groupedResults.propio];
  }, [variant, results, groupedResults]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

  useEffect(() => {
    if (selectedCodigo) {
      setSelectedLabel(
        selectedDenominacion
          ? `${selectedCodigo} — ${selectedDenominacion}`
          : selectedCodigo,
      );
    } else if (!query) {
      setSelectedLabel(null);
    }
  }, [selectedCodigo, selectedDenominacion, query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < minCatalogoQueryLength(trimmed)) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const items = await searchCatalogoRef.current(trimmed, CATALOGO_SEARCH_MAX_RESULTS);
        setResults(items);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  function handleSelect(item: CatalogoNacional) {
    pickingRef.current = false;
    onSelectRef.current(item);
    setSelectedLabel(`${item.codigo} — ${item.denominacion}`);
    setQuery("");
    setResults([]);
    setOpen(false);
    setActiveIndex(-1);
  }

  async function resolveExactCodigo(codigo: string) {
    const resolve = resolveCodigoRef.current;
    if (!resolve) return;
    const item = await resolve(codigo);
    if (item) handleSelect(item);
  }

  function handleListPointerDown() {
    pickingRef.current = true;
  }

  const trimmedQuery = query.trim();
  const showNoResults =
    !selectedCodigo &&
    trimmedQuery.length >= minCatalogoQueryLength(trimmedQuery) &&
    !loading &&
    results.length === 0 &&
    open;
  const resultsTruncated = !loading && results.length >= CATALOGO_SEARCH_MAX_RESULTS;
  const showList = open && (loading || results.length > 0);

  useLayoutEffect(() => {
    if (!showList || !anchorRef.current) {
      setMenuLayout(null);
      return;
    }

    function updatePosition() {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      const menuHeight = listRef.current?.getBoundingClientRect().height ?? 0;
      setMenuLayout(
        computeFloatingMenuLayout(rect, menuHeight, { preferredMaxHeight: 240 }),
      );
    }

    updatePosition();
    const frameId = requestAnimationFrame(() => updatePosition());
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [showList, results.length, loading]);

  const listbox =
    showList && menuLayout ? (
      <ul
        id="catalogo_search_listbox"
        ref={listRef}
        role="listbox"
        onMouseDown={handleListPointerDown}
        className="overflow-auto rounded-md border border-border bg-card py-1 text-card-foreground shadow-lg ring-1 ring-border/50"
        style={{
          position: "fixed",
          top: menuLayout.top,
          left: menuLayout.left,
          minWidth: menuLayout.minWidth,
          maxWidth: menuLayout.maxWidth,
          maxHeight: menuLayout.maxHeight,
          width: "max-content",
          zIndex: 300,
        }}
      >
        {loading && results.length === 0 && (
          <li className="px-3 py-2 text-sm text-muted-foreground">Buscando…</li>
        )}
        {variant === "ambos" ? (
          <>
            {groupedResults.nacional.length > 0 && (
              <>
                <li className="sticky top-0 z-[1] border-b border-border/70 bg-muted/95 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                  Catálogo nacional
                </li>
                {groupedResults.nacional.map((item, index) => (
                  <li key={item.codigo}>
                    <CatalogoResultButton
                      item={item}
                      active={index === activeIndex}
                      optionId={`catalogo-option-${item.codigo}`}
                      onSelect={handleSelect}
                      onHover={() => setActiveIndex(index)}
                    />
                  </li>
                ))}
              </>
            )}
            {groupedResults.propio.length > 0 && (
              <>
                <li className="sticky top-0 z-[1] border-b border-border/70 bg-muted/95 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                  Catálogo propio
                </li>
                {groupedResults.propio.map((item, index) => {
                  const optionIndex = groupedResults.nacional.length + index;
                  return (
                    <li key={item.codigo}>
                      <CatalogoResultButton
                        item={item}
                        active={optionIndex === activeIndex}
                        optionId={`catalogo-option-${item.codigo}`}
                        onSelect={handleSelect}
                        onHover={() => setActiveIndex(optionIndex)}
                      />
                    </li>
                  );
                })}
              </>
            )}
          </>
        ) : (
          results.map((item, index) => (
            <li key={item.codigo}>
              <CatalogoResultButton
                item={item}
                active={index === activeIndex}
                optionId={`catalogo-option-${item.codigo}`}
                onSelect={handleSelect}
                onHover={() => setActiveIndex(index)}
              />
            </li>
          ))
        )}
        {loading && results.length > 0 && (
          <li className="border-t px-3 py-1.5 text-xs text-muted-foreground">Actualizando…</li>
        )}
        {resultsTruncated && (
          <li className="sticky bottom-0 border-t border-border/70 bg-muted/90 px-3 py-2 text-xs text-muted-foreground backdrop-blur-sm">
            Se muestran los primeros {CATALOGO_SEARCH_MAX_RESULTS} resultados. Añada más palabras o
            el código completo para reducir la lista.
          </li>
        )}
      </ul>
    ) : null;

  return (
    <div ref={containerRef} className={open ? "relative z-50 space-y-2" : "space-y-2"}>
      <Label htmlFor="catalogo_search">{copy.label}</Label>
      <p className="text-xs text-muted-foreground">{copy.hint}</p>
      <div ref={anchorRef} className="relative">
        <Input
          id="catalogo_search"
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={showList ? "catalogo_search_listbox" : undefined}
          aria-activedescendant={
            showList && selectableItems[activeIndex]
              ? `catalogo-option-${selectableItems[activeIndex].codigo}`
              : undefined
          }
          autoComplete="off"
          placeholder={copy.placeholder}
          value={query}
          disabled={disabled}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(-1);
            if (selectedLabel || selectedCodigo) {
              setSelectedLabel(null);
              onClear?.();
            }
          }}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          onBlur={() => {
            if (pickingRef.current || !resolveCodigoRef.current) return;
            const trimmed = query.trim();
            if (looksLikeCatalogoCodigo(trimmed, variant) && trimmed !== selectedCodigo) {
              void resolveExactCodigo(trimmed);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              return;
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              if (selectableItems.length === 0) return;
              event.preventDefault();
              setOpen(true);
              setActiveIndex((current) => {
                const last = selectableItems.length - 1;
                if (event.key === "ArrowDown") {
                  if (current < 0) return 0;
                  return current >= last ? 0 : current + 1;
                }
                if (current < 0) return last;
                return current <= 0 ? last : current - 1;
              });
              return;
            }
            if (event.key !== "Enter") return;
            event.preventDefault();
            const trimmed = query.trim();
            if (!trimmed) return;
            const exact = results.find((item) => item.codigo === trimmed);
            if (exact) {
              handleSelect(exact);
              return;
            }
            if (resolveCodigoRef.current && looksLikeCatalogoCodigo(trimmed, variant)) {
              void resolveExactCodigo(trimmed);
              return;
            }
            const highlighted = selectableItems[activeIndex] ?? selectableItems[0];
            if (highlighted) handleSelect(highlighted);
          }}
        />
      </div>

      {typeof document !== "undefined" && listbox ? createPortal(listbox, document.body) : null}

      {selectedLabel && (
        <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          Seleccionado: <strong>{selectedLabel}</strong>
        </p>
      )}

      {showNoResults && (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>{copy.empty}</p>
          {renderAddMissing?.(trimmedQuery)}
        </div>
      )}
    </div>
  );
}
