"use client";

import { useEffect, useRef, type Ref } from "react";
import { useElapsedTimer } from "@/lib/useElapsedTimer";
import { LifebuoyIcon } from "./icons";

/* ------------------------------------------------------------------ */
/* Crisis support                                                      */
/* ------------------------------------------------------------------ */

export const CRISIS_DIRECTORY_URL = "https://findahelpline.com";

export interface CrisisAlertBannerProps {
  /** "detected" when automated analysis flagged crisis; "manual" when opened by the user. */
  variant: "detected" | "manual";
  onClose: () => void;
  headingRef?: Ref<HTMLHeadingElement>;
}

export function CrisisAlertBanner({ variant, onClose, headingRef }: CrisisAlertBannerProps) {
  return (
    <section
      aria-labelledby="crisis-heading"
      className="rounded-2xl border border-rose-400/40 bg-slate-900 p-6 shadow-lg shadow-black/20 sm:p-8"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-300">
          <LifebuoyIcon width={22} height={22} />
        </span>
        <div className="space-y-4">
          <h2 id="crisis-heading" ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-slate-50 focus:outline-none">
            {variant === "detected" ? "It sounds like you may need support right now" : "Get urgent support"}
          </h2>
          <p className="leading-relaxed text-slate-300">
            {variant === "detected"
              ? "What you wrote matters, and you deserve support from a real person right now. You don't have to work through this alone or with an app."
              : "If things feel like too much, reaching out to a real person can help. You don't have to handle this alone."}
          </p>
          <ul className="space-y-3 text-slate-200">
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-rose-300">•</span>
              <span>
                <strong className="font-semibold text-slate-50">If you are in immediate danger, contact your local emergency services now.</strong>
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-rose-300">•</span>
              <span>
                Find a free, confidential crisis line in your country:{" "}
                <a
                  href={CRISIS_DIRECTORY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-300 underline underline-offset-4 hover:text-teal-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
                >
                  findahelpline.com
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-rose-300">•</span>
              <span>Reach out to someone you trust and let them know how you&apos;re feeling.</span>
            </li>
          </ul>
          <p className="text-sm leading-relaxed text-slate-400">
            AnchorMind&apos;s automatic check can miss things or get them wrong. A reflection without this message
            doesn&apos;t mean everything is safe — trust your own sense of what you need.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-slate-700 px-5 text-sm font-medium text-slate-200 hover:border-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
          >
            {variant === "detected" ? "Start a new reflection" : "Back"}
          </button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Breathing pacer                                                     */
/* ------------------------------------------------------------------ */

export const BREATH_PHASES = [
  { key: "inhale", label: "Breathe in", seconds: 4 },
  { key: "hold", label: "Hold gently", seconds: 4 },
  { key: "exhale", label: "Breathe out slowly", seconds: 6 },
] as const;
export const BREATH_CYCLES = 3;
const CYCLE_MS = BREATH_PHASES.reduce((sum, p) => sum + p.seconds * 1000, 0);
export const BREATHING_TOTAL_MS = CYCLE_MS * BREATH_CYCLES; // 42,000 ms

export function breathingStateAt(elapsedMs: number) {
  const clamped = Math.min(Math.max(elapsedMs, 0), BREATHING_TOTAL_MS);
  const cycle = Math.min(Math.floor(clamped / CYCLE_MS), BREATH_CYCLES - 1);
  let within = clamped - cycle * CYCLE_MS;
  for (const phase of BREATH_PHASES) {
    const ms = phase.seconds * 1000;
    if (within < ms || phase.key === "exhale") {
      const progress = Math.min(within / ms, 1);
      const remainingSeconds = Math.max(Math.ceil((ms - within) / 1000), 0);
      return { cycle: cycle + 1, phase, progress, remainingSeconds };
    }
    within -= ms;
  }
  // Unreachable; satisfies the type checker.
  return { cycle: BREATH_CYCLES, phase: BREATH_PHASES[2], progress: 1, remainingSeconds: 0 };
}

function circleScale(key: string, progress: number) {
  if (key === "inhale") return 0.6 + 0.4 * progress;
  if (key === "hold") return 1;
  return 1 - 0.4 * progress;
}

export interface BreathingPacerGateProps {
  /** Called exactly once, when the exercise completes or is skipped. */
  onDone: (reason: "completed" | "skipped") => void;
  headingRef?: Ref<HTMLHeadingElement>;
}

export function BreathingPacerGate({ onDone, headingRef }: BreathingPacerGateProps) {
  const timer = useElapsedTimer(BREATHING_TOTAL_MS, { autoStart: true });
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (timer.status === "done" && !doneRef.current) {
      doneRef.current = true;
      onDoneRef.current("completed");
    }
  }, [timer.status]);

  const skip = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    timer.pause();
    onDoneRef.current("skipped");
  };

  const state = breathingStateAt(timer.elapsedMs);
  const paused = timer.status === "paused";
  const scale = circleScale(state.phase.key, state.progress);

  return (
    <section aria-labelledby="breathing-heading" className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg shadow-black/20 sm:p-8">
      <h2 id="breathing-heading" ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-slate-50 focus:outline-none">
        Let&apos;s slow things down first
      </h2>
      <p className="mt-2 max-w-prose leading-relaxed text-slate-300">
        Your reflection is ready. Before reading it, here are three slow breaths together — about 40 seconds. If
        holding or counting feels uncomfortable, just breathe naturally, or skip whenever you like.
      </p>

      <div className="my-8 flex flex-col items-center gap-6">
        <div className="relative flex h-56 w-56 items-center justify-center" aria-hidden="true">
          <div className="absolute inset-0 rounded-full border border-teal-500/20" />
          <div
            data-testid="breathing-circle"
            className="absolute inset-0 rounded-full bg-teal-500/20 ring-1 ring-teal-400/40 transition-transform duration-100 ease-linear motion-reduce:transition-none motion-reduce:transform-none!"
            style={{ transform: `scale(${scale.toFixed(3)})` }}
          />
          <span className="relative text-5xl font-light tabular-nums text-teal-100">{state.remainingSeconds}</span>
        </div>

        <div className="text-center">
          <p className="text-2xl font-medium text-slate-50" aria-live="polite" aria-atomic="true">
            {paused ? "Paused" : state.phase.label}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Breath {state.cycle} of {BREATH_CYCLES}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={paused ? timer.resume : timer.pause}
          disabled={timer.status === "done"}
          className="min-h-11 rounded-xl border border-slate-700 px-5 text-sm font-medium text-slate-200 hover:border-teal-500 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          type="button"
          onClick={timer.restart}
          disabled={timer.status === "done"}
          className="min-h-11 rounded-xl border border-slate-700 px-5 text-sm font-medium text-slate-200 hover:border-teal-500 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
        >
          Restart
        </button>
        <button
          type="button"
          onClick={skip}
          className="min-h-11 rounded-xl bg-teal-500 px-5 text-sm font-semibold text-slate-950 hover:bg-teal-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
        >
          Skip and view reflection
        </button>
      </div>
    </section>
  );
}

export default BreathingPacerGate;
