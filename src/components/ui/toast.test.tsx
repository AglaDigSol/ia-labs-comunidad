// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Popover, PopoverContent, PopoverTrigger } from "./popover.tsx";
import { __resetToastForTests, dismissToast, holdToasts, showToast, ToastHost } from "./toast.tsx";

beforeEach(() => {
  vi.useFakeTimers();
  __resetToastForTests();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Toast", () => {
  it("renders in a polite live region and disappears after 6000 ms", () => {
    render(<ToastHost />);
    act(() => void showToast({ message: "Actualizado en Google Calendar", tone: "ok", icon: "calendar-check" }));
    expect(screen.getByText("Actualizado en Google Calendar")).toBeTruthy();
    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    act(() => void vi.advanceTimersByTime(5999));
    expect(screen.queryByText("Actualizado en Google Calendar")).toBeTruthy();
    act(() => void vi.advanceTimersByTime(2));
    expect(screen.queryByText("Actualizado en Google Calendar")).toBeNull();
  });

  it("a second toast replaces the first", () => {
    render(<ToastHost />);
    act(() => void showToast({ message: "Uno" }));
    act(() => void showToast({ message: "Dos" }));
    expect(screen.queryByText("Uno")).toBeNull();
    expect(screen.getByText("Dos")).toBeTruthy();
  });

  it("warn lasts 10000 ms and the action fires and dismisses", () => {
    render(<ToastHost />);
    const onAction = vi.fn();
    act(() => void showToast({ message: "Error", tone: "warn", action: { label: "Reintentar", onAction } }));
    act(() => void vi.advanceTimersByTime(9000));
    expect(screen.getByText("Error")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Error")).toBeNull();
  });

  it("warn disappears at 10000 ms", () => {
    render(<ToastHost />);
    act(() => void showToast({ message: "Error", tone: "warn" }));
    act(() => void vi.advanceTimersByTime(10001));
    expect(screen.queryByText("Error")).toBeNull();
  });

  it("hover pauses and leaving resumes; Escape dismisses", () => {
    render(<ToastHost />);
    act(() => void showToast({ message: "Pausa" }));
    const toast = screen.getByText("Pausa").closest("div")!;
    act(() => void vi.advanceTimersByTime(4000));
    fireEvent.mouseEnter(toast);
    act(() => void vi.advanceTimersByTime(20000));
    expect(screen.getByText("Pausa")).toBeTruthy();
    fireEvent.mouseLeave(toast);
    act(() => void vi.advanceTimersByTime(1999));
    expect(screen.getByText("Pausa")).toBeTruthy();
    act(() => void vi.advanceTimersByTime(2));
    expect(screen.queryByText("Pausa")).toBeNull();

    act(() => void showToast({ message: "Esc" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Esc")).toBeNull();
  });

  it("two hosts render the toast once", () => {
    render(
      <>
        <ToastHost />
        <ToastHost />
      </>,
    );
    act(() => void showToast({ message: "Solo una vez" }));
    expect(screen.getAllByText("Solo una vez")).toHaveLength(1);
  });

  it("onClose fires exactly once: timeout, action, Escape, replacement", () => {
    render(<ToastHost />);
    const a = vi.fn();
    act(() => void showToast({ message: "A", onClose: a }));
    act(() => void vi.advanceTimersByTime(7000));
    expect(a).toHaveBeenCalledTimes(1);

    const b = vi.fn();
    act(() => void showToast({ message: "B", onClose: b, action: { label: "Ir", onAction: () => {} } }));
    fireEvent.click(screen.getByRole("button", { name: "Ir" }));
    act(() => void vi.advanceTimersByTime(7000));
    expect(b).toHaveBeenCalledTimes(1);

    const c = vi.fn();
    act(() => void showToast({ message: "C", onClose: c }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(c).toHaveBeenCalledTimes(1);

    const d = vi.fn();
    act(() => void showToast({ message: "D", onClose: d }));
    act(() => void showToast({ message: "E" }));
    expect(d).toHaveBeenCalledTimes(1);
    act(() => void vi.advanceTimersByTime(7000));
    expect(d).toHaveBeenCalledTimes(1);
  });
});

describe("Toast hold (exam mode) and persistent", () => {
  it("persistent toasts do not auto-close", () => {
    render(<ToastHost />);
    act(() => void showToast({ message: "Nueva versión disponible", persistent: true, action: { label: "Recargar la app", onAction: () => {} } }));
    act(() => void vi.advanceTimersByTime(60_000));
    expect(screen.getByText("Nueva versión disponible")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Nueva versión disponible")).toBeNull();
  });

  it("holds non-exam toasts, keeps only the latest and shows it when the hold ends", () => {
    render(<ToastHost />);
    const first = vi.fn();
    holdToasts(true);
    act(() => void showToast({ message: "Primero", onClose: first }));
    act(() => void showToast({ message: "Segundo" }));
    expect(screen.queryByText("Primero")).toBeNull();
    expect(screen.queryByText("Segundo")).toBeNull();
    expect(first).toHaveBeenCalledTimes(1);
    act(() => void showToast({ message: "Del intento", exam: true }));
    expect(screen.getByText("Del intento")).toBeTruthy();
    act(() => holdToasts(false));
    expect(screen.getByText("Segundo")).toBeTruthy();
    expect(screen.queryByText("Del intento")).toBeNull();
    act(() => void vi.advanceTimersByTime(6001));
    expect(screen.queryByText("Segundo")).toBeNull();
  });

  it("starting a hold moves a visible non-exam toast to the hold; a held toast can be dismissed by id", () => {
    render(<ToastHost />);
    act(() => void showToast({ message: "Visible" }));
    act(() => holdToasts(true));
    expect(screen.queryByText("Visible")).toBeNull();
    const onClose = vi.fn();
    let id = 0;
    act(() => void (id = showToast({ message: "Retenido", onClose })));
    dismissToast(id);
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => holdToasts(false));
    expect(screen.queryByText("Retenido")).toBeNull();
    expect(screen.queryByText("Visible")).toBeNull();
  });
});

describe("Popover", () => {
  it("opens as a dialog, Escape closes and focus returns to the trigger", async () => {
    vi.useRealTimers();
    render(
      <Popover>
        <PopoverTrigger>Abrir</PopoverTrigger>
        <PopoverContent>Contenido</PopoverContent>
      </Popover>,
    );
    const trigger = screen.getByRole("button", { name: "Abrir" });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
