import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** Normaliza VITE_BASE ("/", "/labs", "labs/") a la forma que espera Vite: "/labs/". */
function normalizeBase(raw: string | undefined): string {
  const trimmed = (raw ?? "").trim().replace(/^\/+|\/+$/g, "");
  return trimmed === "" ? "/" : `/${trimmed}/`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    base: normalizeBase(env.VITE_BASE ?? process.env.VITE_BASE),
    plugins: [react(), tailwindcss()],
    build: {
      assetsInlineLimit: 0,
    },
    test: {
      environment: "node",
      include: ["src/**/*.test.{ts,tsx}", "shared/**/*.test.ts", "content/**/*.test.ts", "tests/**/*.test.ts"],
    },
  };
});
