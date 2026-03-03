// app/layout.tsx
import type { Metadata } from "next";
import localFont from "next/font/local";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
import SiteHeader from "@/components/navigation/SiteHeader";

// Use a locally bundled font to avoid external network fetches during CI/e2e builds
// This prevents build failures when Google Fonts is unreachable.
const inter = localFont({
  src: "../fonts/Roboto-Regular.ttf",
  variable: "--font-sans",
  weight: "400",
  style: "normal",
});

export const metadata: Metadata = {
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
        <main className="flex-1">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
