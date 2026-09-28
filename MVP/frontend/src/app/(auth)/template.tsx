import type { ReactNode } from "react";

// A template (unlike a layout) re-mounts on every navigation, so the page
// fades up on each route change while the nav in the layout stays put.
export default function Template({ children }: { children: ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
