"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/* Minimal declarations for the (non-standardized) Web Speech API. */
interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
}
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionResultListLike {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResultLike;
}
interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}
interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

function getCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const noopSubscribe = () => () => {};

export function speechErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access was blocked. You can allow it in your browser settings, or keep typing.";
    case "no-speech":
      return "We didn't catch any speech. Try again, or type instead.";
    case "audio-capture":
      return "No microphone was found. You can type instead.";
    case "network":
      return "Voice input needs a network connection. You can type instead.";
    case "aborted":
      return "";
    default:
      return "Voice input stopped unexpectedly. You can try again or type instead.";
  }
}

export function appendTranscript(existing: string, addition: string): string {
  const piece = addition.trim();
  if (!piece) return existing;
  if (!existing) return piece;
  return /\s$/.test(existing) ? existing + piece : `${existing} ${piece}`;
}

/**
 * Speech-to-text that appends only finalized results via `onFinalText`.
 * Each final result index is delivered at most once per session.
 */
export function useSpeechRecognition(onFinalText: (text: string) => void) {
  const supported = useSyncExternalStore(noopSubscribe, () => Boolean(getCtor()), () => false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const callbackRef = useRef(onFinalText);

  useEffect(() => {
    callbackRef.current = onFinalText;
  }, [onFinalText]);

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    recognitionRef.current = null;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    try {
      rec.stop();
    } catch {
      // Already stopped.
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) {
      setError("Voice input isn't supported in this browser. You can type instead.");
      return;
    }
    if (recognitionRef.current) return;
    setError(null);

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US";
    const delivered = new Set<number>();

    rec.onresult = (event) => {
      const pieces: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result || !result.isFinal || delivered.has(i)) continue;
        delivered.add(i);
        const transcript = (result[0]?.transcript ?? "").trim();
        if (transcript) pieces.push(transcript);
      }
      // One update per event so multiple finals never overwrite each other.
      if (pieces.length > 0) callbackRef.current(pieces.join(" "));
    };
    rec.onerror = (event) => {
      const message = speechErrorMessage(event.error);
      if (message) setError(message);
    };
    rec.onend = () => {
      if (recognitionRef.current === rec) recognitionRef.current = null;
      setListening(false);
    };

    try {
      rec.start();
      recognitionRef.current = rec;
      setListening(true);
    } catch {
      setError("Voice input couldn't start. You can type instead.");
    }
  }, []);

  useEffect(() => {
    return () => {
      const rec = recognitionRef.current;
      if (rec) {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        try {
          rec.abort();
        } catch {
          // Ignore.
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  return { supported, listening, error, start, stop };
}
