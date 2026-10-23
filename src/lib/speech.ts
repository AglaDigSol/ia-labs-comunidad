import { useCallback, useEffect, useRef, useState } from "react";

export function speechSupported(): boolean {
  return (
    typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window
  );
}

export function pickSpanishVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  return (
    voices.find((v) => v.lang === "es-ES") ??
    voices.find((v) => /^es([-_]|$)/i.test(v.lang)) ??
    null
  );
}

export interface SpeakOptions {
  onEnd?: () => void;
  onError?: () => void;
}

let current: SpeechSynthesisUtterance | null = null;

/** Must be called synchronously from a click handler (iOS gesture rule). */
export function speak(text: string, { onEnd, onError }: SpeakOptions = {}): void {
  if (!speechSupported()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new window.SpeechSynthesisUtterance(text);
  u.lang = "es-ES";
  u.rate = 0.9;
  // Voices may load late: read them again at click time.
  const voice = pickSpanishVoice(synth.getVoices());
  if (voice) u.voice = voice;
  current = u;
  u.onend = () => {
    if (current !== u) return;
    current = null;
    onEnd?.();
  };
  u.onerror = (ev: SpeechSynthesisErrorEvent) => {
    if (current !== u) return;
    current = null;
    if (ev?.error === "canceled" || ev?.error === "interrupted") onEnd?.();
    else onError?.();
  };
  synth.speak(u);
}

export function cancelSpeech(): void {
  if (!speechSupported()) return;
  current = null;
  window.speechSynthesis.cancel();
}

export function useSpeech() {
  const supported = speechSupported();
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState(false);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [spanish, setSpanish] = useState(true);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    if (!supported) return;
    const synth = window.speechSynthesis;
    const read = () => {
      const voices = synth.getVoices();
      if (voices.length === 0) return;
      setVoicesLoaded(true);
      setSpanish(pickSpanishVoice(voices) !== null);
    };
    read();
    synth.addEventListener?.("voiceschanged", read);
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        cancelSpeech();
        if (alive.current) setSpeaking(false);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive.current = false;
      synth.removeEventListener?.("voiceschanged", read);
      document.removeEventListener("visibilitychange", onVis);
      cancelSpeech();
    };
  }, [supported]);

  const doSpeak = useCallback((text: string) => {
    setError(false);
    setSpeaking(true);
    speak(text, {
      onEnd: () => {
        if (alive.current) setSpeaking(false);
      },
      onError: () => {
        if (!alive.current) return;
        setSpeaking(false);
        setError(true);
      },
    });
  }, []);

  const stop = useCallback(() => {
    cancelSpeech();
    setSpeaking(false);
  }, []);

  return {
    supported,
    speaking,
    voicesLoaded,
    hasSpanishVoice: spanish,
    speak: doSpeak,
    stop,
    error,
  };
}
