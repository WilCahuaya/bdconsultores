import { decryptString } from "./crypto";
import { SunatCredencialesInvalidasError, SunatError } from "./errors";
import { sunatFetch } from "./http";

const TOKEN_URL = "https://api-seguridad.sunat.gob.pe/v1/clientessol";
const SCOPE = "https://api-sire.sunat.gob.pe";
const SKEW_MS = 60_000;

export interface SunatCredencialSecreto {
  entidadId: string;
  ruc: string;
  usuarioSol: string;
  clientId: string;
  claveSolCifrada: string;
  clientSecretCifrado: string;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
  msg?: string;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

const cache = new Map<string, CachedToken>();
const inflight = new Map<string, Promise<string>>();

export async function getAccessToken(
  row: SunatCredencialSecreto,
  scope: string = SCOPE,
): Promise<string> {
  const cacheKey = `${scope}:${row.ruc}:${row.usuarioSol}:${row.clientId}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) return hit.accessToken;

  const pending = inflight.get(cacheKey);
  if (pending) return pending;

  const promise = requestToken(row, scope)
    .then((token) => {
      cache.set(cacheKey, token);
      return token.accessToken;
    })
    .finally(() => inflight.delete(cacheKey));

  inflight.set(cacheKey, promise);
  return promise;
}

async function requestToken(row: SunatCredencialSecreto, scope: string): Promise<CachedToken> {
  const claveSol = decryptString(row.claveSolCifrada, row.entidadId);
  const clientSecret = decryptString(row.clientSecretCifrado, row.entidadId);
  const body = new URLSearchParams({
    grant_type: "password",
    scope,
    client_id: row.clientId,
    client_secret: clientSecret,
    username: `${row.ruc}${row.usuarioSol}`,
    password: claveSol,
  });

  const res = await sunatFetch(`${TOKEN_URL}/${encodeURIComponent(row.clientId)}/oauth2/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    timeoutMs: 20_000,
  });

  const json = (await res.json().catch(() => ({}))) as TokenResponse;
  if (res.status === 400 || res.status === 401 || json.error) {
    throw new SunatCredencialesInvalidasError(json.error_description || json.msg);
  }
  if (!res.ok || !json.access_token || !json.expires_in) {
    throw new SunatError("SUNAT no entregó el token de acceso.", "TOKEN", res.status);
  }

  return {
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000 - SKEW_MS,
  };
}
