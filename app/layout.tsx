// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { BookOpen, FilePlus2 } from "lucide-react";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

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
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          inter.variable
        )}
      >
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center">
            <div className="mr-4 flex items-center">
              <Link href="/" className="mr-6 flex items-center space-x-2">
                <BookOpen className="h-6 w-6" />
                <span className="font-bold">Talent Test</span>
              </Link>
              <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
                <Link
                  href="/questions"
                  className="transition-colors hover:text-foreground/80 text-foreground/60"
                >
                  Questions
                </Link>
                <Link
                  href="/question-paper"
                  className="transition-colors hover:text-foreground/80 text-foreground/60"
                >
                  Papers
                </Link>
                <Link
                  href="/subjects"
                  className="transition-colors hover:text-foreground/80 text-foreground/60"
                >
                  Subjects & Tags
                </Link>
              </nav>
            </div>
            <div className="flex flex-1 items-center justify-end space-x-2">
              <Button asChild>
                <Link href="/question-paper/create">
                  <FilePlus2 className="mr-2 h-4 w-4" />
                  Create Paper
                </Link>
              </Button>
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}