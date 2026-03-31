import type { ReactNode } from "react";

export default function WorkspacePlainLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="app-page-frame">{children}</div>;
}
