import { AlertTriangle, CalendarCheck, Check, ListChecks } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "../../lib/cn.ts";
import { Button } from "./button.tsx";

export const TOAST_MS = 6000;
export const TOAST_ERROR_MS = 10000;

export type ToastTone = "neutral" | "ok" | "warn";
export type ToastInput = {
  message: string;
  tone?: ToastTone;
  icon?: "calendar-check" | "list-checks" | "check" | "alert" | null;
  action?: { label: string; onAction: () => void };
  durationMs?: number;
  /** Called exactly once when this toast leaves: timeout, action, Escape, dismiss or replacement. */
  onClose?: () => void;
  /** Toast of the running simulacro: shown even while toasts are held (holdToasts). */
  exam?: boolean;
  /** No auto-close (e.g. «Nueva versión disponible»); leaves on action, Escape, dismiss or replacement. */
  persistent?: boolean;
};

type ToastState = (ToastInput & { id: number; durationMs: number }) | null;

let state: ToastState = null;
let seq = 0;
let owner: symbol | null = null;
// While a simulacro runs (exam mode) non-exam toasts are held; only the latest is kept and shown afterwards.
let holding = false;
let held: ToastState = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function leave(): void {
  const prev = state;
  state = null;
  emit();
  prev?.onClose?.();
}

export function showToast(t: ToastInput): number {
  const id = ++seq;
  const next = { ...t, id, durationMs: t.durationMs ?? (t.tone === "warn" ? TOAST_ERROR_MS : TOAST_MS) };
  if (holding && !t.exam) {
    const prevHeld = held;
    held = next;
    prevHeld?.onClose?.();
    return id;
  }
  const prev = state;
  state = next;
  emit();
  prev?.onClose?.();
  return id;
}

export function dismissToast(id?: number): void {
  if (held && id !== undefined && held.id === id) {
    const h = held;
    held = null;
    h.onClose?.();
    return;
  }
  if (!state || (id !== undefined && state.id !== id)) return;
  leave();
}

/**
 * Exam mode (D-04, UI-SPEC "Toasts during an attempt"): while on, only toasts with `exam: true` are shown.
 * A visible non-exam toast is moved to the hold; when the hold ends the latest held toast is shown.
 */
export function holdToasts(on: boolean): void {
  if (on === holding) return;
  holding = on;
  if (on) {
    if (state && !state.exam) {
      const prevHeld = held;
      held = state;
      state = null;
      emit();
      prevHeld?.onClose?.();
    }
    return;
  }
  if (held) {
    const h = held;
    held = null;
    const prev = state;
    state = { ...h, id: ++seq };
    emit();
    prev?.onClose?.();
  }
}

export function __resetToastForTests(): void {
  state = null;
  owner = null;
  holding = false;
  held = null;
  seq = 0;
  listeners.clear();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

const ICONS = {
  "calendar-check": CalendarCheck,
  "list-checks": ListChecks,
  check: Check,
  alert: AlertTriangle,
} as const;

const TONES: Record<ToastTone, string> = {
  neutral: "border-border bg-raised text-fg",
  ok: "border-transparent bg-ok-bg text-ok",
  warn: "border-transparent bg-warn-bg text-warn",
};

function ToastView({ toast }: { toast: NonNullable<ToastState> }) {
  const remaining = useRef(toast.durationMs);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [pauseCount, setPauseCount] = useState(0);
  const paused = pauseCount > 0;

  useEffect(() => {
    if (paused || toast.persistent) return;
    startedAt.current = Date.now();
    timer.current = setTimeout(() => dismissToast(toast.id), remaining.current);
    return () => {
      clearTimeout(timer.current);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    };
  }, [paused, toast.id, toast.persistent]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissToast(toast.id);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toast.id]);

  const pause = useCallback(() => setPauseCount((c) => c + 1), []);
  const resume = useCallback(() => setPauseCount((c) => Math.max(0, c - 1)), []);
  const Icon = toast.icon ? ICONS[toast.icon] : null;

  return (
    <div
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      className={cn(
        "pointer-events-auto flex items-center gap-3 rounded-md border px-4 py-2 text-[14px] shadow-md motion-safe:transition-opacity",
        TONES[toast.tone ?? "neutral"],
      )}
    >
      {Icon ? <Icon size={16} strokeWidth={1.75} aria-hidden="true" /> : null}
      <span>{toast.message}</span>
      {toast.action ? (
        <Button
          variant="ghost"
          onClick={() => {
            const action = toast.action!;
            action.onAction();
            dismissToast(toast.id);
          }}
        >
          {toast.action.label}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Singleton: only the first mounted host renders. The region is the polite live region.
 * `className` adjusts the position (AppShell lifts it above the fixed SM-2 buttons on phones).
 */
export function ToastHost({ className }: { className?: string } = {}) {
  const toast = useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
  const token = useRef(Symbol("toast-host"));
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const me = token.current;
    if (owner === null) {
      owner = me;
      setIsOwner(true);
    }
    return () => {
      if (owner === me) owner = null;
    };
  }, []);

  if (!isOwner) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom)+16px)] z-50 flex justify-center px-4 lg:bottom-4",
        className,
      )}
    >
      <div className="flex w-full max-w-[420px] justify-center">
        {toast ? <ToastView key={toast.id} toast={toast} /> : null}
      </div>
    </div>
  );
}
