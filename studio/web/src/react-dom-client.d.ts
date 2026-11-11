// Minimal typing for react-dom/client (the project has no @types/react-dom;
// Remotion does not need it). Only what main.tsx uses.
declare module "react-dom/client" {
  import type { ReactNode } from "react";
  export function createRoot(container: Element | DocumentFragment): { render(children: ReactNode): void; unmount(): void };
}
