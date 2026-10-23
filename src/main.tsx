import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { z } from "zod";
import "katex/dist/katex.min.css";
import "./styles/tokens.css";
import { App } from "./App.tsx";

// Modo jitless para evitar la sonda eval/new Function bajo CSP script-src 'self'
z.config({ jitless: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
