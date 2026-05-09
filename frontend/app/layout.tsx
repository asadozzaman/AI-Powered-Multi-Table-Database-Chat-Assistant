import type { Metadata } from "next";
import "./globals.css";
import { AuthGate } from "@/components/AuthGate";
import { Nav } from "@/components/Nav";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "DB Chat AI - Multi-Table Database Assistant",
  description: "Natural language analytics, schema exploration, and data management over relational databases.",
  other: {
    google: "notranslate",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="notranslate" translate="no" suppressHydrationWarning>
      <body className="notranslate" translate="no" suppressHydrationWarning>
        <ToastProvider>
          <div className="app-shell">
            <Nav />
            <main>
              <div className="page-container">
                <AuthGate>{children}</AuthGate>
              </div>
            </main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
