import { useEffect } from "react";
import { keys, type ThemePref } from "../../shared/keys.ts";
import { useKv } from "./kv-store.ts";

const LIGHT_COLOR = "#F3F5F9";
const DARK_COLOR = "#0E1320";

export function sanitizeTheme(v: unknown): ThemePref {
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

function storedPref(): ThemePref {
  try {
    return sanitizeTheme(localStorage.getItem("theme"));
  } catch {
    return "system";
  }
}

export function applyTheme(pref: ThemePref): void {
  const dark = pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  root.dataset.theme = dark ? "dark" : "light";
  root.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? DARK_COLOR : LIGHT_COLOR);
  try {
    localStorage.setItem("theme", pref);
  } catch {
    /* storage unavailable: preference lives only in KV */
  }
}

/** Current theme preference (KV wins over localStorage); applies it whenever it changes. */
export function useThemePref(): ThemePref {
  const raw = useKv<unknown>(keys.pref.theme, storedPref());
  const pref = sanitizeTheme(raw);
  useEffect(() => {
    applyTheme(pref);
    if (pref !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);
  return pref;
}
