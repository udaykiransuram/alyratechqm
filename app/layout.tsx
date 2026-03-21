// app/layout.tsx
import type { Metadata } from "next";
import localFont from "next/font/local";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toaster";
import {
  COMPANY_NAME,
  HOME_DESCRIPTION,
  PRODUCT_NAME,
  getMetadataBase,
} from "@/lib/seo";
import "./globals.css";
import AppChrome from "@/components/layout/AppChrome";

// Use a locally bundled font to avoid external network fetches during CI/e2e builds
// This prevents build failures when Google Fonts is unreachable.
const inter = localFont({
  src: "../fonts/Roboto-Regular.ttf",
  variable: "--font-sans",
  weight: "400",
  style: "normal",
});

const metadataBase = getMetadataBase();

export const metadata: Metadata = {
  metadataBase,
  applicationName: PRODUCT_NAME,
  title: {
    default: PRODUCT_NAME,
    template: `%s | ${COMPANY_NAME}`,
  },
  description: HOME_DESCRIPTION,
  category: "education",
  creator: COMPANY_NAME,
  publisher: COMPANY_NAME,
  formatDetection: {
    address: false,
    email: false,
    telephone: false,
  },
  openGraph: {
    locale: "en_IN",
    siteName: COMPANY_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
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
        <AppChrome>{children}</AppChrome>
        <Toaster />
      </body>
    </html>
  );
}
