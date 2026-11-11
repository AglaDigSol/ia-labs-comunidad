import "./zod-config.ts";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "katex/dist/katex.min.css";
import "./styles/tokens.css";
import { App } from "./App.tsx";
import { showToast } from "./components/ui/toast.tsx";
import { OFFLINE_READY_MESSAGE, registerServiceWorker } from "./lib/offline.ts";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Instalable y sin conexión: solo en el build (en `npm run dev` un service worker estorbaría).
if (import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void registerServiceWorker({
      base: import.meta.env.BASE_URL,
      onFirstReady: () => showToast({ tone: "ok", icon: "check", message: OFFLINE_READY_MESSAGE }),
    });
  });
}
