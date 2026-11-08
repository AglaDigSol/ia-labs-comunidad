// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isSmartQuoteError, SmartQuotesHint, straightenQuotes } from "./SmartQuotes.tsx";

afterEach(cleanup);

describe("comillas tipográficas en Python", () => {
  it("reconoce el SyntaxError de Python y el de una cadena sin cerrar con comillas tipográficas", () => {
    expect(isSmartQuoteError("SyntaxError: invalid character '“' (U+201C)")).toBe(true);
    expect(isSmartQuoteError("SyntaxError: invalid character '’' (U+2019)")).toBe(true);
    expect(isSmartQuoteError("SyntaxError: unterminated string literal", "print(‘hola)")).toBe(true);
    expect(isSmartQuoteError("SyntaxError: invalid syntax", 'print("hola")')).toBe(false);
    expect(isSmartQuoteError("NameError: name 'x' is not defined", "print(“x”)")).toBe(false);
    expect(isSmartQuoteError(null)).toBe(false);
  });

  it("cambia todas por rectas", () => {
    expect(straightenQuotes("print(“hola”)\nd = {‘a’: 1}")).toBe("print(\"hola\")\nd = {'a': 1}");
  });

  it("el botón devuelve el código corregido", () => {
    const onFix = vi.fn();
    render(<SmartQuotesHint code="print(“hola”)" onFix={onFix} />);
    expect(screen.getByRole("note").textContent).toMatch(/^Tus comillas son tipográficas/);
    fireEvent.click(screen.getByRole("button", { name: "Cambiar por comillas rectas" }));
    expect(onFix).toHaveBeenCalledWith('print("hola")');
  });
});
