import { useId, type ComponentType, type ReactNode } from "react";

type Icon = ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean | "true"; className?: string }>;

/** Tarjeta del inicio: una sección con su título (h2) y una acción al pie. */
export function HomeCard({ title, icon: I, children }: { title: string; icon: Icon; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-raised p-4">
      <h2 id={id} className="flex items-center gap-2 font-display text-[20px] font-semibold leading-[1.2]">
        <I size={20} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-accent" />
        {title}
      </h2>
      {children}
    </section>
  );
}
