import { webAppById } from "@bd/config";

export function urlAsistenciaExcel(params: { mes: string; relacionId?: string; entidadId?: string }): string {
  const query = new URLSearchParams({ mes: params.mes });
  if (params.relacionId) query.set("relacionId", params.relacionId);
  if (params.entidadId) query.set("entidadId", params.entidadId);
  return `${webAppById("planillas").basePath}/api/asistencias/excel?${query.toString()}`;
}

export async function descargarAsistenciaExcel(params: {
  mes: string;
  relacionId?: string;
  entidadId?: string;
}): Promise<{ error?: string }> {
  const res = await fetch(urlAsistenciaExcel(params), {
    credentials: "same-origin",
    redirect: "manual",
  });
  if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
    return { error: "La sesión expiró. Vuelva a iniciar sesión." };
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return { error: data?.error ?? "No se pudo descargar el Excel." };
  }
  const type = res.headers.get("Content-Type") ?? "";
  if (!type.includes("spreadsheetml") && !type.includes("octet-stream")) {
    return { error: "No se pudo descargar el Excel." };
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") ?? "";
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  const plain = /filename="([^"]+)"/i.exec(cd);
  const name = star ? decodeURIComponent(star[1]) : (plain?.[1] ?? "asistencia.xlsx");
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
  URL.revokeObjectURL(href);
  return {};
}
