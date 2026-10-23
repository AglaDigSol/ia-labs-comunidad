import { useEffect, useState } from "react";

/** Epoch ms, re-rendered on interval boundaries; paused while the tab is hidden. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      const t = Date.now();
      timer = setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, intervalMs - (t % intervalMs) + 1);
    };
    const stop = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    };
    const onVisibility = () => {
      stop();
      if (!document.hidden) {
        setNow(Date.now());
        schedule();
      }
    };
    if (!document.hidden) schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);
  return now;
}
