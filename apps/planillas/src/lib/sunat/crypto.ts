import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function encryptionKey(): Buffer {
  const raw = readEncryptionKey();
  if (!raw) {
    throw new Error("Falta ENCRYPTION_KEY en el servidor de Planillas.");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY debe ser 32 bytes en base64.");
  }
  return key;
}

/** Next a veces no inyecta la variable en el proceso. El archivo local es el respaldo. */
function readEncryptionKey(): string | undefined {
  const fromEnv = process.env.ENCRYPTION_KEY?.trim();
  if (fromEnv) return fromEnv;

  const files = [join(process.cwd(), ".env.local"), join(process.cwd(), "apps", "planillas", ".env.local")];
  for (const file of files) {
    try {
      const match = readFileSync(file, "utf8").match(/^ENCRYPTION_KEY=(.*)$/m);
      const value = match?.[1]?.trim().replace(/^['"]|['"]$/g, "");
      if (value) return value;
    } catch {
      // Esa ruta no existe en este proceso.
    }
  }
  return undefined;
}

/** v1.<iv>.<tag>.<ciphertext> en base64url. aad identifica la empresa. */
export function encryptString(plain: string, aad: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, encryptionKey(), iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptString(payload: string, aad: string): string {
  const [version, ivB64, tagB64, ctB64] = payload.split(".");
  if (version !== "v1" || !ivB64 || !tagB64 || !ctB64) {
    throw new Error("La credencial guardada no se puede leer. Vuelva a guardarla.");
  }
  const decipher = createDecipheriv(ALGO, encryptionKey(), Buffer.from(ivB64, "base64url"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]).toString("utf8");
}
