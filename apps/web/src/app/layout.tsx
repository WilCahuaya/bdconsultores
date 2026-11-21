import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { APP_CLIENT, PLATFORM_NAME } from "@inventario/types";
import "@inventario/ui/globals.css";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  metadataBase: new URL("https://bdconsultores.org"),
  title: PLATFORM_NAME,
  description: `Plataforma de gestión — ${APP_CLIENT}`,
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "96x96" }],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
};

const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (stored === "dark" || (!stored && prefersDark)) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={`${inter.variable} h-full`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="h-full overflow-hidden font-sans antialiased">{children}</body>
    </html>
  );
}
