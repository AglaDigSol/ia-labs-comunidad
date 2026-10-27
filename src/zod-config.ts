// zod sin JIT: evita su sonda con new Function, que la CSP (script-src 'self', sin unsafe-eval) bloquea y
// anota como securitypolicyviolation. Va en su propio módulo, importado el primero en main.tsx: los
// esquemas que se definen al importar los módulos ya comprueban la sonda al construirse, así que la
// configuración tiene que aplicarse antes de evaluar el resto del grafo.
import { z } from "zod";

z.config({ jitless: true });
