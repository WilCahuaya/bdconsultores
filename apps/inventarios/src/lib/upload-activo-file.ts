import { createClient } from "@/lib/supabase/client";

export async function uploadActivoFile(
  entidadId: string,
  activoId: string,
  file: File,
  kind: "foto" | "comprobante",
  previousPath?: string | null,
): Promise<{ path?: string; error?: string }> {
  const bucket = kind === "foto" ? "fotos-activos" : "comprobantes-activos";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${entidadId}/${activoId}/${kind}.${ext}`;

  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });

  if (error) return { error: error.message };

  // Si cambió la extensión, el path anterior queda huérfano: borrarlo.
  if (previousPath && previousPath !== path) {
    await supabase.storage.from(bucket).remove([previousPath]);
  }

  return { path };
}
