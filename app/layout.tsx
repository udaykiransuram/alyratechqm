// app/layout.tsx
import type { Metadata } from "next";
import localFont from "next/font/local";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
import SiteHeader from "@/components/navigation/SiteHeader";
import AppViewport from "@/components/layout/AppViewport";

// Use a locally bundled font to avoid external network fetches during CI/e2e builds
// This prevents build failures when Google Fonts is unreachable.
const inter = localFont({
  src: "../fonts/Roboto-Regular.ttf",
  variable: "--font-sans",
  weight: "400",
  style: "normal",
});

const metadataBase = (() => {
  const candidate =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";

  try {
    return new URL(candidate);
  } catch {
    return new URL("http://localhost:3000");
  }
})();

export const metadata: Metadata = {
  metadataBase,
  title: "Talent Test Platform",
  description: "Create, manage, and administer question papers and tests.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          inter.variable,
        )}
      >
        <SiteHeader />
        <main className="min-h-screen pt-[calc(var(--app-header-height)+var(--app-mobile-school-switcher-height))] transition-[margin-left] duration-200 ease-in-out md:pt-[var(--app-header-height)] lg:ml-[var(--app-sidebar-width)]">
          <AppViewport>{children}</AppViewport>
        </main>
        <Toaster />
      </body>
    </html>
  );
}
