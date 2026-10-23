import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn.ts";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-md border border-border bg-sunken px-3 text-fg placeholder:text-muted",
        className,
      )}
      {...props}
    />
  );
}
