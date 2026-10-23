// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cancelSpeech, speak, speechSupported, useSpeech } from "./speech.ts";

type W = Record<string, unknown>;
const w = window as unknown as W;

class FakeUtterance {
  text: string;
  lang = "";
  rate = 1;
  voice: unknown = null;
  onend: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

const calls: string[] = [];
let voices: Array<{ lang: string; name: string }> = [];
let spoken: FakeUtterance[] = [];
let listeners: Array<() => void> = [];

function install() {
  calls.length = 0;
  spoken = [];
  listeners = [];
  w.SpeechSynthesisUtterance = FakeUtterance;
  w.speechSynthesis = {
    cancel: vi.fn(() => calls.push("cancel")),
    speak: vi.fn((u: FakeUtterance) => {
      calls.push("speak");
      spoken.push(u);
    }),
    getVoices: () => voices,
    addEventListener: (_: string, fn: () => void) => listeners.push(fn),
    removeEventListener: (_: string, fn: () => void) => {
      listeners = listeners.filter((l) => l !== fn);
    },
  };
}

beforeEach(() => {
  voices = [];
  install();
});

afterEach(() => {
  cleanup();
  delete w.speechSynthesis;
  delete w.SpeechSynthesisUtterance;
});

describe("speech wrapper", () => {
  it("is unsupported without the API", () => {
    delete w.speechSynthesis;
    delete w.SpeechSynthesisUtterance;
    expect(speechSupported()).toBe(false);
  });

  it("cancels first, then speaks es-ES at rate 0.9 with the es-ES voice", () => {
    voices = [
      { lang: "en-US", name: "a" },
      { lang: "es-MX", name: "b" },
      { lang: "es-ES", name: "c" },
    ];
    speak("pe implica cu");
    expect(calls).toEqual(["cancel", "speak"]);
    const u = spoken[0]!;
    expect(u.lang).toBe("es-ES");
    expect(u.rate).toBe(0.9);
    expect((u.voice as { name: string }).name).toBe("c");
  });

  it("falls back to es_US and then to no voice", () => {
    voices = [
      { lang: "en-US", name: "a" },
      { lang: "es_US", name: "u" },
    ];
    speak("x");
    expect((spoken[0]!.voice as { name: string }).name).toBe("u");
    voices = [{ lang: "en-US", name: "a" }];
    speak("x");
    expect(spoken[1]!.voice).toBeNull();
    expect(spoken[1]!.lang).toBe("es-ES");
  });

  it("cancelSpeech cancels", () => {
    cancelSpeech();
    expect(calls).toEqual(["cancel"]);
  });
});

describe("useSpeech", () => {
  function Probe({ out }: { out: { current: ReturnType<typeof useSpeech> | null } }) {
    out.current = useSpeech();
    return null;
  }

  it("flags a missing Spanish voice only after voices loaded; cancels on unmount", () => {
    const out: { current: ReturnType<typeof useSpeech> | null } = { current: null };
    const { unmount } = render(createElement(Probe, { out }));
    expect(out.current!.hasSpanishVoice).toBe(true);
    expect(out.current!.voicesLoaded).toBe(false);
    voices = [{ lang: "en-US", name: "a" }];
    act(() => listeners.forEach((l) => l()));
    expect(out.current!.voicesLoaded).toBe(true);
    expect(out.current!.hasSpanishVoice).toBe(false);
    calls.length = 0;
    unmount();
    expect(calls).toContain("cancel");
  });

  it("tracks speaking state", () => {
    const out: { current: ReturnType<typeof useSpeech> | null } = { current: null };
    render(createElement(Probe, { out }));
    act(() => out.current!.speak("hola"));
    expect(out.current!.speaking).toBe(true);
    act(() => spoken[0]!.onend?.());
    expect(out.current!.speaking).toBe(false);
  });
});
