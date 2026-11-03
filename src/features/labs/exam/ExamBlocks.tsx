// Enunciados y soluciones del simulacro (ExamBlock de shared/exam): párrafos con fórmulas en línea,
// fórmulas destacadas, listas y pseudocódigo. El TeX lo escribe el código, nunca la persona.
import { Tex } from "../../../lib/tex.tsx";
import { cn } from "../../../lib/cn.ts";
import type { ExamBlock, ExamInline } from "../../../../shared/exam/types.ts";

function Inline({ parts }: { parts: readonly ExamInline[] }) {
  return (
    <>
      {parts.map((p, i) => (typeof p === "string" ? <span key={i}>{p}</span> : <Tex key={i} tex={p.tex} label={p.label} />))}
    </>
  );
}

export function ExamBlocks({ blocks, className }: { blocks: readonly ExamBlock[]; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "p":
            return (
              <p key={i} className={cn("min-w-0 break-words", b.strong && "font-semibold", b.muted && "text-[14px] text-muted")}>
                <Inline parts={b.parts} />
              </p>
            );
          case "math":
            return <Tex key={i} display tex={b.tex} label={b.label} className="max-w-full text-[18px]" />;
          case "list":
            return (
              <ul key={i} className="flex list-disc flex-col gap-1 pl-6">
                {b.items.map((it, k) => (
                  <li key={k} className="min-w-0 break-words">
                    <Inline parts={it} />
                  </li>
                ))}
              </ul>
            );
          case "code":
            return (
              <pre key={i} tabIndex={0} aria-label={b.label} className="max-w-full overflow-x-auto rounded-md border border-border bg-sunken p-3 font-mono text-[15px] leading-relaxed">
                <code>{b.lines.join("\n")}</code>
              </pre>
            );
        }
      })}
    </div>
  );
}
