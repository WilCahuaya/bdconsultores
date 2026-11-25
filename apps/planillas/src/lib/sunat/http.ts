import { SunatError, SunatTimeoutError } from "./errors";

const RETRY_STATUS = new Set([429, 502, 503, 504]);

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sunatFetch(url: string, init: RequestInit & { timeoutMs: number }): Promise<Response> {
  const { timeoutMs, ...rest } = init;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
      if (RETRY_STATUS.has(res.status) && attempt < 2) {
        await delay(500 * 2 ** attempt);
        continue;
      }
      return res;
    } catch (error) {
      lastError = error;
      const aborted = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      if (aborted && attempt === 2) throw new SunatTimeoutError();
      if (attempt === 2) break;
      await delay(500 * 2 ** attempt);
    }
  }
  throw lastError instanceof SunatError
    ? lastError
    : new SunatError("No hubo respuesta de SUNAT.");
}
