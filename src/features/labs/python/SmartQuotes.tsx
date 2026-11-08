// Comillas tipográficas en el código Python (“ ” ‘ ’): las pone el iPad (puntuación inteligente) o
// llegan al copiar de un PDF, y Python responde con un SyntaxError en inglés. Si el error es ese, un
// aviso en español lo explica y ofrece cambiarlas por comillas rectas con un toque.
import { Info } from "lucide-react";
import { Button } from "../../../components/ui/button.tsx";

const SMART = /[“”„‟‘’‚‛«»′″]/;
/** El SyntaxError de Python con una comilla tipográfica («invalid character '“' (U+201C)»). */
const SMART_ERROR = /invalid character '.' \(U\+(201C|201D|201E|201F|2018|2019|201A|201B|00AB|00BB|2032|2033)\)/;

/** ¿El error es por comillas tipográficas en el código? */
export function isSmartQuoteError(error: string | null | undefined, code?: string): boolean {
  if (!error) return false;
  if (SMART_ERROR.test(error)) return true;
  // Algunos mensajes no nombran el carácter («unterminated string literal»…): basta con que el
  // código tenga comillas tipográficas y el error sea de sintaxis.
  return code !== undefined && /SyntaxError/.test(error) && SMART.test(code);
}

/** Cambia las comillas tipográficas por rectas: “ ” „ « » ″ → " y ‘ ’ ‚ ′ → '. */
export function straightenQuotes(code: string): string {
  return code.replace(/[“”„‟«»″]/g, '"').replace(/[‘’‚‛′]/g, "'");
}

export const COPY_SMART_QUOTES =
  "Tus comillas son tipográficas (“ ” o ‘ ’), y Python solo entiende las rectas (\" y '). Pasa al escribir en el iPad (puntuación inteligente) o al copiar de un PDF.";

/** El aviso con el botón «Cambiar por comillas rectas». */
export function SmartQuotesHint({ code, onFix }: { code: string; onFix: (fixed: string) => void }) {
  return (
    <div role="note" className="flex flex-col items-start gap-2 rounded-md bg-warn-bg px-3 py-2 text-[14px] text-warn" data-smart-quotes="">
      <p className="flex items-start gap-2">
        <Info size={16} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>{COPY_SMART_QUOTES}</span>
      </p>
      <Button variant="secondary" onClick={() => onFix(straightenQuotes(code))}>
        Cambiar por comillas rectas
      </Button>
    </div>
  );
}
