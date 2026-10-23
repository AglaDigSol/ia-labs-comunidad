import type { TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn.ts";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-md border border-border bg-sunken p-3 text-fg placeholder:text-muted",
        className,
      )}
      {...props}
    />
  );
}
