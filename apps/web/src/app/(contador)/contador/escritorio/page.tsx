import { redirect } from "next/navigation";
import { DesktopInstallerCard } from "@inventario/ui/panel";
import {
  findDesktopInstaller,
  formatInstallerDate,
  formatInstallerSize,
} from "@inventario/ui/desktop-installer-server";
import { PanelPageHeader } from "@/components/panel/panel-ui";
import { requireProfile } from "@/lib/auth/profile";

export const dynamic = "force-dynamic";

export default async function ContadorEscritorioPage() {
  try {
    await requireProfile("CONTADOR");
  } catch {
    redirect("/login");
  }

  const installer = await findDesktopInstaller();

  return (
    <div className="space-y-6">
      <PanelPageHeader
        title="Aplicación de escritorio"
        subtitle="Descargue el instalador vigente para Windows."
      />
      <DesktopInstallerCard
        available={Boolean(installer)}
        version={installer?.version ?? "0.1.0"}
        fileName={installer?.fileName ?? null}
        sizeLabel={installer ? formatInstallerSize(installer.sizeBytes) : null}
        updatedLabel={
          installer.updatedAt.getTime() > 0 ? formatInstallerDate(installer.updatedAt) : null
        }
        downloadHref={installer ? installer.externalUrl ?? "/api/desktop-installer" : null}
      />
    </div>
  );
}
