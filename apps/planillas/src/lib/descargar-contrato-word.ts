import { webAppById } from "@bd/config";

export function urlContratoWord(relacionId: string, contratoId: string): string {
  return `${webAppById("planillas").basePath}/api/contratos/${relacionId}/word?contratoId=${encodeURIComponent(contratoId)}`;
}

export async function descargarContratoWord(
  relacionId: string,
  contratoId: string,
): Promise<{ error?: string }> {
  const res = await fetch(urlContratoWord(relacionId, contratoId), {
    credentials: "same-origin",
    redirect: "manual",
  });
  if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
    return { error: "La sesión expiró. Vuelva a iniciar sesión." };
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return { error: data?.error ?? "No se pudo descargar el Word." };
  }
  const type = res.headers.get("Content-Type") ?? "";
  if (!type.includes("wordprocessingml")) {
    return { error: "No se pudo descargar el Word." };
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") ?? "";
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  const plain = /filename="([^"]+)"/i.exec(cd);
  const name = star ? decodeURIComponent(star[1]) : (plain?.[1] ?? "contrato.docx");
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
  URL.revokeObjectURL(href);
  return {};
}
