import type { Metadata } from "next";
import { Footer } from "@/components/public/Footer";
import { Navbar } from "@/components/public/Navbar";

const SITE_URL = "https://bdconsultores.org";
const SITE_TITLE = "B&D Consultores | Estudio contable";
const SITE_DESCRIPTION =
  "Estudio contable en Perú. Asesoría contable, tributaria y financiera, y control de activos para entidades públicas y privadas.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | B&D Consultores",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "es_PE",
    url: SITE_URL,
    siteName: "B&D Consultores",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: SITE_TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og.png"],
  },
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-main-scroll flex h-dvh min-h-0 w-full max-w-full flex-col">
      <Navbar />
      <main className="public-page flex-1">{children}</main>
      <Footer />
    </div>
  );
}
