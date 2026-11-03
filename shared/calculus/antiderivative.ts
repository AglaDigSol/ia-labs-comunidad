// Primitivas inmediatas (para la solución, nunca para corregir: la corrección deriva la respuesta):
// linealidad, xⁿ, 1/x, y las de argumento lineal u = a·x + b: uⁿ, 1/u, eᵘ, sen u y cos u. Si la
// función no es de estas, devuelve null y la app dice que no sabe escribirla.
import { div as fdiv, equals, frac, isZero, mul as fmul, add as fadd, ONE, type Frac } from "../rational.ts";
import { dependsOn, type Expr } from "./expr.ts";
import { exprToPoly, polyDegree2 } from "./poly.ts";
import { tidy } from "./simplify.ts";

const numE = (v: Frac): Expr => ({ k: "num", v });
const mulOf = (...xs: Expr[]): Expr => (xs.length === 1 ? xs[0]! : { k: "mul", args: xs });

/** a·x + b si la expresión es lineal en x (a ≠ 0). */
function linearArg(u: Expr): { a: Frac; b: Frac } | null {
  const p = exprToPoly(u);
  if (!p || polyDegree2(p) !== 1 || [...p.keys()].some((k) => k !== "1,0" && k !== "0,0")) return null;
  const a = p.get("1,0");
  return a ? { a, b: p.get("0,0") ?? frac(0n) } : null;
}

/** Exponente racional constante (2, −1, 1/2…). */
function constExponent(e: Expr): Frac | null {
  if (e.k === "num") return e.v;
  if (e.k === "neg") {
    const a = constExponent(e.a);
    return a && { n: -a.n, d: a.d };
  }
  if (e.k === "div") {
    const a = constExponent(e.a);
    const b = constExponent(e.b);
    return a && b && !isZero(b) ? fdiv(a, b) : null;
  }
  return null;
}

function raw(f: Expr): Expr | null {
  if (!dependsOn(f, "x")) return mulOf(f, { k: "var", name: "x" });
  switch (f.k) {
    case "add": {
      const parts = f.args.map(raw);
      return parts.every((p): p is Expr => p !== null) ? { k: "add", args: parts } : null;
    }
    case "neg": {
      const a = raw(f.a);
      return a && { k: "neg", a };
    }
    case "mul": {
      const consts = f.args.filter((a) => !dependsOn(a, "x"));
      const rest = f.args.filter((a) => dependsOn(a, "x"));
      if (rest.length !== 1) return null;
      const a = raw(rest[0]!);
      return a && mulOf(...consts, a);
    }
    case "div": {
      if (!dependsOn(f.b, "x")) {
        const a = raw(f.a);
        return a && { k: "div", a, b: f.b };
      }
      // k/u con u lineal: k·ln|u|/a; k/uⁿ como k·u⁻ⁿ.
      if (dependsOn(f.a, "x")) return null;
      if (f.b.k === "pow") return raw({ k: "mul", args: [f.a, { k: "pow", a: f.b.a, b: { k: "neg", a: f.b.b } }] });
      return raw({ k: "mul", args: [f.a, { k: "pow", a: f.b, b: numE(frac(-1n)) }] });
    }
    case "var":
      return { k: "div", a: { k: "pow", a: f, b: numE(frac(2n)) }, b: numE(frac(2n)) };
    case "pow": {
      const n = constExponent(f.b);
      const lin = linearArg(f.a);
      if (n && lin) {
        // ∫ uⁿ dx = uⁿ⁺¹ / (a·(n + 1)); con n = −1, ln|u| / a.
        if (equals(n, frac(-1n))) return { k: "div", a: { k: "fn", name: "ln", a: { k: "fn", name: "abs", a: f.a } }, b: numE(lin.a) };
        const n1 = fadd(n, ONE);
        return { k: "div", a: { k: "pow", a: f.a, b: numE(n1) }, b: numE(fmul(lin.a, n1)) };
      }
      // eᵘ con u lineal.
      if (f.a.k === "const" && f.a.name === "e") return raw({ k: "fn", name: "exp", a: f.b });
      return null;
    }
    case "fn": {
      const lin = linearArg(f.a);
      if (!lin) return null;
      const over = (e: Expr): Expr => (equals(lin.a, ONE) ? e : { k: "div", a: e, b: numE(lin.a) });
      switch (f.name) {
        case "exp":
          return over(f);
        case "sin":
          return over({ k: "neg", a: { k: "fn", name: "cos", a: f.a } });
        case "cos":
          return over({ k: "fn", name: "sin", a: f.a });
        case "sqrt":
          return raw({ k: "pow", a: f.a, b: numE(frac(1n, 2n)) });
        default:
          return null;
      }
    }
    default:
      return null;
  }
}

/** Una primitiva de f (sin la constante), escrita como en un libro, o null si no es inmediata. */
export function antiderivative(f: Expr): Expr | null {
  const r = raw(f);
  return r && tidy(r);
}
