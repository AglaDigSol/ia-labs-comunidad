import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn.ts";

export const chipVariants = cva(
  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[14px] font-semibold leading-[1.4]",
  {
    variants: {
      tone: {
        ok: "bg-ok-bg text-ok",
        warn: "bg-warn-bg text-warn",
        crit: "bg-crit-bg text-crit",
        info: "bg-info-bg text-info",
        outline: "border border-border text-fg",
        solidCrit: "bg-crit text-on-crit",
      },
    },
    defaultVariants: { tone: "info" },
  },
);

export type ChipProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof chipVariants>;

export function Chip({ className, tone, ...props }: ChipProps) {
  return <span className={cn(chipVariants({ tone }), className)} {...props} />;
}
