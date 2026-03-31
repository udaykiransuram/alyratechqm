import type { ReactNode } from "react";

export default function WorkspaceShellLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="app-workspace-shell">
      <div className="app-page-frame">{children}</div>
    </div>
  );
}
