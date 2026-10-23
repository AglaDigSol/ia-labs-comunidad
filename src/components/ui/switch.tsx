import * as SwitchPrimitive from "@radix-ui/react-switch";
import { useId, type ComponentProps } from "react";
import { cn } from "../../lib/cn.ts";

type SwitchProps = ComponentProps<typeof SwitchPrimitive.Root> & {
  /** Visible label rendered next to the switch (clicking it toggles). */
  label?: string;
};

export function Switch({ className, label, id, ...props }: SwitchProps) {
  const auto = useId();
  const switchId = id ?? auto;
  const root = (
    <SwitchPrimitive.Root
      id={switchId}
      className={cn(
        // 44px hit area around a 24x44 track
        "relative inline-flex h-11 w-14 shrink-0 cursor-pointer items-center rounded-md px-1.5",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:pointer-events-none disabled:opacity-50",
        "group",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-1.5 top-1/2 h-6 -translate-y-1/2 rounded-full border border-border bg-sunken transition-colors group-data-[state=checked]:border-accent group-data-[state=checked]:bg-accent"
      />
      <SwitchPrimitive.Thumb className="pointer-events-none relative block h-5 w-5 translate-x-0 rounded-full bg-fg transition-transform data-[state=checked]:translate-x-[22px] data-[state=checked]:bg-on-accent" />
    </SwitchPrimitive.Root>
  );
  if (!label) return root;
  return (
    <div className="inline-flex min-h-11 items-center gap-2">
      {root}
      <label htmlFor={switchId} className="cursor-pointer text-[14px] font-semibold">
        {label}
      </label>
    </div>
  );
}
