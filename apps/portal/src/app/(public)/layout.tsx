import { Footer } from "@/components/public/Footer";
import { Navbar } from "@/components/public/Navbar";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-main-scroll flex h-dvh min-h-0 w-full max-w-full flex-col">
      <Navbar />
      <main className="public-page flex-1">{children}</main>
      <Footer />
    </div>
  );
}
