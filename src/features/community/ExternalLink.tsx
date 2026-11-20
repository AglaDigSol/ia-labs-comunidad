import { ExternalLink as ExtIcon } from "lucide-react";
import { extractSafeDomain, isSafeUrl } from "../../../shared/community/validation.ts";

export function ExternalLink({ url, className = "" }: { url: string; className?: string }) {
  if (!isSafeUrl(url)) return null;

  const domain = extractSafeDomain(url);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-lg border border-border bg-sunken/40 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-hover hover:border-accent/40 transition-colors group ${className}`}
      title={url}
    >
      <span className="truncate max-w-[200px] sm:max-w-xs">{url}</span>
      <span className="rounded bg-sunken px-1.5 py-0.2 text-[10px] font-mono text-muted group-hover:text-accent">
        {domain}
      </span>
      <ExtIcon size={12} className="text-muted group-hover:text-accent shrink-0" aria-hidden="true" />
    </a>
  );
}
