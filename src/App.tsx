import { Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AppShell } from "./components/layout/AppShell.tsx";
import { activeModules, type AppModule } from "./config.ts";
import { t } from "./i18n/index.ts";
import { useThemePref } from "./lib/theme.ts";

/** Base del router: la misma que la de Vite (VITE_BASE), sin la barra final. */
export const ROUTER_BASENAME = import.meta.env.BASE_URL.replace(/\/+$/, "") || "/";

function AreaFallback() {
  return (
    <div
      aria-busy="true"
      aria-label={t.app.loading}
      className="min-h-[240px] animate-pulse rounded-md bg-sunken motion-reduce:animate-none"
    />
  );
}

export function AppRoutes({ modules = activeModules() }: { modules?: AppModule[] }) {
  return (
    <Suspense fallback={<AreaFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="/laboratorios" replace />} />
        {modules.map(({ id, path, component: Page }) => (
          <Route key={id} path={path} element={<Page />} />
        ))}
        <Route path="*" element={<Navigate to="/laboratorios" replace />} />
      </Routes>
    </Suspense>
  );
}

export function App() {
  useThemePref();
  return (
    <BrowserRouter basename={ROUTER_BASENAME}>
      <AppShell>
        <AppRoutes />
      </AppShell>
    </BrowserRouter>
  );
}
