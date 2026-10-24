import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { z } from "zod";
import "katex/dist/katex.min.css";
import "./styles/tokens.css";
import { App } from "./App.tsx";

// zod sin JIT: evita su sonda con new Function, que la CSP (script-src 'self', sin unsafe-eval) bloquea.
z.config({ jitless: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
