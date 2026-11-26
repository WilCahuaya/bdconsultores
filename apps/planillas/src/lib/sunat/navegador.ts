import { createRequire } from "node:module";
import type { Browser } from "playwright";

const requerir = createRequire(import.meta.url);

/** Chromium de Playwright. En el instalador usa el navegador que viaja con el programa. */
export async function abrirNavegador(): Promise<Browser> {
  const id = process.env.BAJADA_PLAYWRIGHT?.trim();
  const playwright = id ? (requerir(id) as typeof import("playwright")) : await import("playwright");
  const executablePath = process.env.BAJADA_CHROMIUM?.trim();
  return playwright.chromium.launch({
    headless: false,
    ...(executablePath ? { executablePath } : {}),
  });
}
