import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn.ts";

export function ToggleGroup({ className, ...props }: ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      className={cn("inline-flex overflow-hidden rounded-md border border-border bg-raised", className)}
      {...props}
    />
  );
}

export function ToggleGroupItem({ className, ...props }: ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      className={cn(
        "min-h-11 min-w-11 px-4 text-[14px] font-semibold text-fg transition-colors hover:bg-sunken",
        "data-[state=on]:bg-accent data-[state=on]:text-on-accent",
        className,
      )}
      {...props}
    />
  );
}
