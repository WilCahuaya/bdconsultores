import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { Browser } from "playwright";

function requerir(id: string): typeof import("playwright") {
  const archivo = typeof __filename === "string" ? __filename : fileURLToPath(import.meta.url);
  return createRequire(archivo)(id) as typeof import("playwright");
}

/** Chromium de Playwright. En el instalador usa el navegador que viaja con el programa. */
export async function abrirNavegador(): Promise<Browser> {
  const id = process.env.BAJADA_PLAYWRIGHT?.trim();
  const playwright = id ? requerir(id) : await import("playwright");
  const executablePath = process.env.BAJADA_CHROMIUM?.trim();
  return playwright.chromium.launch({
    headless: false,
    ...(executablePath ? { executablePath } : {}),
  });
}
