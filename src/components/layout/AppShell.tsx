import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useRef, type ComponentType, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router";
import { keys, type ThemePref } from "../../../shared/keys.ts";
import { activeModules, navPath, REPO_URL } from "../../config.ts";
import { t } from "../../i18n/index.ts";
import { cn } from "../../lib/cn.ts";
import { setKv } from "../../lib/kv-store.ts";
import { useThemePref } from "../../lib/theme.ts";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group.tsx";
import { TooltipProvider } from "../ui/tooltip.tsx";
import { ToastHost } from "../ui/toast.tsx";

type Icon = ComponentType<{
  size?: number;
  strokeWidth?: number;
  "aria-hidden"?: boolean | "true";
  className?: string;
}>;

/** Destinos de navegación de los módulos activos (src/config.ts). */
export function navItems() {
  return activeModules().map((m) => ({ to: navPath(m), ...m.nav }));
}

/** Repaso en móvil: los botones SM-2 van fijos sobre la barra inferior (2 × 64px + 8px). */
const REVIEW_ROUTE = /^\/flashcards\/repaso\/?$/;
const TOAST_ABOVE_GRADES = "max-sm:bottom-[calc(56px+2*64px+8px+env(safe-area-inset-bottom)+16px)]";

const THEMES: Array<{ value: ThemePref; label: string; icon: Icon }> = [
  { value: "light", label: t.theme.light, icon: Sun },
  { value: "system", label: t.theme.system, icon: Monitor },
  { value: "dark", label: t.theme.dark, icon: Moon },
];

export function ThemeToggle() {
  const theme = useThemePref();
  return (
    <ToggleGroup
      type="single"
      value={theme}
      aria-label={t.theme.label}
      onValueChange={(v) => {
        if (v) setKv(keys.pref.theme, v);
      }}
    >
      {THEMES.map(({ value, label, icon: I }) => (
        <ToggleGroupItem key={value} value={value} aria-label={label} title={label}>
          <I size={16} strokeWidth={1.75} aria-hidden="true" />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex min-h-11 items-center gap-2 rounded-md px-3 font-semibold",
    isActive ? "bg-accent-soft text-accent" : "text-fg hover:bg-sunken",
  );

export function Footer() {
  return (
    <footer className="mt-12 border-t border-border pt-4 text-[14px] text-muted">
      <p>{t.app.disclaimer}</p>
      <p className="mt-1">
        {t.app.licenses} ·{" "}
        <a href={REPO_URL} className="underline hover:text-fg" rel="noreferrer" target="_blank">
          {t.app.contribute}
        </a>
      </p>
    </footer>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const first = useRef(true);
  const nav = navItems();
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.querySelector<HTMLElement>("main h1")?.focus();
  }, [pathname]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/* Barra lateral >= 1024px */}
        <aside className="hidden border-r border-border bg-raised lg:block">
          <div className="sticky top-0 flex h-dvh flex-col gap-4 overflow-y-auto p-4">
            <div>
              <p className="font-display text-[20px] font-semibold leading-[1.2]">{t.app.name}</p>
              <p className="text-[14px] text-muted">{t.app.tagline}</p>
            </div>
            <nav aria-label={t.nav.main} className="flex flex-col gap-1">
              {nav.map(({ to, label, icon: I, end }) => (
                <NavLink key={to} to={to} end={end} className={navClass}>
                  <I size={20} strokeWidth={1.75} aria-hidden="true" />
                  {label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-auto flex flex-col items-start gap-2">
              <ThemeToggle />
            </div>
          </div>
        </aside>

        {/* Barra superior < 1024px */}
        <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-raised px-4 pt-[env(safe-area-inset-top)] lg:hidden">
          <span className="font-display text-[20px] font-semibold">{t.app.name}</span>
        </header>

        <main className="mx-auto w-full max-w-[1200px] px-4 py-6 pb-24 sm:max-w-[720px] lg:max-w-[1200px] lg:px-8 lg:pb-8">
          {children}
          <Footer />
        </main>

        {/* Barra inferior < 1024px */}
        <nav
          aria-label={t.nav.main}
          className="fixed inset-x-0 bottom-0 z-30 box-content flex h-14 items-stretch border-t border-border bg-raised pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          {nav.map(({ to, label, short, icon: I, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              aria-label={label}
              className={({ isActive }) =>
                cn(
                  "flex min-h-11 min-w-16 flex-1 flex-col items-center justify-center gap-1 text-[14px] font-semibold",
                  isActive ? "bg-accent-soft text-accent" : "text-muted",
                )
              }
            >
              <I size={20} strokeWidth={1.75} aria-hidden="true" />
              <span className="sr-only sm:not-sr-only" aria-hidden="true">
                {short}
              </span>
            </NavLink>
          ))}
        </nav>
        <ToastHost {...(REVIEW_ROUTE.test(pathname) ? { className: TOAST_ABOVE_GRADES } : {})} />
      </div>
    </TooltipProvider>
  );
}
