"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type TimerStatus = "idle" | "running" | "paused" | "done";

export const TIMER_TICK_MS = 100;

/**
 * Drift-free elapsed-time timer. Elapsed time is always computed from
 * wall-clock deltas (Date.now), never by counting ticks.
 */
export function useElapsedTimer(durationMs: number, options: { autoStart?: boolean } = {}) {
  const [status, setStatus] = useState<TimerStatus>(options.autoStart ? "running" : "idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [runId, setRunId] = useState(0);
  const accumulatedRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (status !== "running") return;
    startedAtRef.current = Date.now();
    const id = setInterval(() => {
      const started = startedAtRef.current;
      if (started === null) return;
      const total = Math.min(durationMs, accumulatedRef.current + (Date.now() - started));
      setElapsedMs(total);
      if (total >= durationMs) {
        accumulatedRef.current = durationMs;
        startedAtRef.current = null;
        setStatus("done");
      }
    }, TIMER_TICK_MS);
    return () => clearInterval(id);
  }, [status, durationMs, runId]);

  const start = useCallback(() => {
    setStatus((s) => (s === "idle" ? "running" : s));
  }, []);

  const pause = useCallback(() => {
    const started = startedAtRef.current;
    if (started === null) return;
    const total = Math.min(durationMs, accumulatedRef.current + (Date.now() - started));
    accumulatedRef.current = total;
    startedAtRef.current = null;
    setElapsedMs(total);
    setStatus("paused");
  }, [durationMs]);

  const resume = useCallback(() => {
    setStatus((s) => (s === "paused" ? "running" : s));
  }, []);

  const reset = useCallback(() => {
    startedAtRef.current = null;
    accumulatedRef.current = 0;
    setElapsedMs(0);
    setStatus("idle");
  }, []);

  const restart = useCallback(() => {
    startedAtRef.current = null;
    accumulatedRef.current = 0;
    setElapsedMs(0);
    setRunId((r) => r + 1);
    setStatus("running");
  }, []);

  return { status, elapsedMs, start, pause, resume, reset, restart };
}
