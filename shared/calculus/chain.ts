// Regla de la cadena en varias variables para una curva c: ℝ → ℝ² seguida de h: ℝ² → ℝ:
// [h∘c]′(t₀) = ∇h(c(t₀)) · c′(t₀) = ∂h/∂x(c(t₀))·c₁′(t₀) + ∂h/∂y(c(t₀))·c₂′(t₀).
// El gradiente se evalúa en el punto c(t₀), no en t₀.
import { derivative } from "./derive.ts";
import { evaluate, type Expr } from "./expr.ts";

export type Vec2 = [number, number];

/** ∇h(c(t₀)) · c′(t₀). */
export const chainRule = (grad: Vec2, velocity: Vec2): number => grad[0] * velocity[0] + grad[1] * velocity[1];

export interface ChainData {
  /** c(t₀). */
  point: Vec2;
  /** c′(t₀). */
  velocity: Vec2;
  /** ∇h(c(t₀)). */
  grad: Vec2;
  /** [h∘c]′(t₀). */
  value: number;
}

/**
 * Con fórmulas: h(x, y) y las dos componentes de la curva escritas en la variable x (que hace de t).
 */
export function chainRuleAt(h: Expr, curve: readonly [Expr, Expr], t0: number): ChainData {
  const point: Vec2 = [evaluate(curve[0], { x: t0 }), evaluate(curve[1], { x: t0 })];
  const velocity: Vec2 = [evaluate(derivative(curve[0]), { x: t0 }), evaluate(derivative(curve[1]), { x: t0 })];
  const at = { x: point[0], y: point[1] };
  const grad: Vec2 = [evaluate(derivative(h, "x"), at), evaluate(derivative(h, "y"), at)];
  return { point, velocity, grad, value: chainRule(grad, velocity) };
}
