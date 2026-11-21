"use client";

import type { Ref } from "react";
import { useElapsedTimer } from "@/lib/useElapsedTimer";
import type { AnalysisResult, ResultSource } from "@/types/analysis";
import { CheckCircleIcon, CloudThoughtIcon, FootprintsIcon, LeafIcon } from "./icons";

export const GROUNDING_MS = 60_000;

export interface DistortionBreakdownProps {
  result: AnalysisResult;
  source: ResultSource;
  onNewReflection: () => void;
  headingRef?: Ref<HTMLHeadingElement>;
}

function DistressGauge({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const descriptor = score >= 8 ? "high" : score >= 5 ? "moderate" : "lower";
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span id="distress-label" className="font-medium text-slate-300">
          Estimated distress
        </span>
        <span className="tabular-nums text-slate-200">
          {score} / 10 <span className="text-slate-400">({descriptor})</span>
        </span>
      </div>
      <div
        role="meter"
        aria-labelledby="distress-label"
        aria-valuemin={1}
        aria-valuemax={10}
        aria-valuenow={score}
        aria-valuetext={`${score} out of 10, ${descriptor}`}
        className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800"
      >
        <div className="h-full rounded-full bg-linear-to-r from-teal-600 to-teal-300" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-slate-500">An AI estimate based on your words — not a clinical assessment.</p>
    </div>
  );
}

function EvidenceColumn({
  title,
  items,
  tone,
  emptyText,
}: {
  title: string;
  items: string[];
  tone: "fact" | "assumption";
  emptyText: string;
}) {
  const styles =
    tone === "fact"
      ? { border: "border-emerald-500/30", icon: "text-emerald-300 bg-emerald-500/10", bullet: "text-emerald-300", title: "text-emerald-200" }
      : { border: "border-amber-500/30", icon: "text-amber-300 bg-amber-500/10", bullet: "text-amber-300", title: "text-amber-200" };
  const Icon = tone === "fact" ? CheckCircleIcon : CloudThoughtIcon;
  return (
    <div className={`rounded-xl border ${styles.border} bg-slate-950/40 p-5`}>
      <h3 className={`flex items-center gap-2 text-base font-semibold ${styles.title}`}>
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${styles.icon}`}>
          <Icon />
        </span>
        {title}
      </h3>
      {items.length > 0 ? (
        <ul className="mt-4 space-y-2.5">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 leading-relaxed text-slate-200">
              <span aria-hidden="true" className={`mt-0.5 ${styles.bullet}`}>
                {tone === "fact" ? "✓" : "?"}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-slate-400">{emptyText}</p>
      )}
    </div>
  );
}

function GroundingTimer() {
  const timer = useElapsedTimer(GROUNDING_MS);
  const remaining = Math.max(Math.ceil((GROUNDING_MS - timer.elapsedMs) / 1000), 0);
  const display = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
  const done = timer.status === "done";

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-16 text-2xl font-light tabular-nums text-slate-100" aria-hidden="true">
          {display}
        </span>
        <span className="sr-only">{done ? "Timer finished" : `${remaining} seconds remaining`}</span>
        {timer.status === "idle" && (
          <button type="button" onClick={timer.start} className="min-h-11 rounded-xl bg-teal-500 px-5 text-sm font-semibold text-slate-950 hover:bg-teal-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300">
            Start 60-second timer
          </button>
        )}
        {(timer.status === "running" || timer.status === "paused") && (
          <button
            type="button"
            onClick={timer.status === "running" ? timer.pause : timer.resume}
            className="min-h-11 rounded-xl border border-slate-700 px-5 text-sm font-medium text-slate-200 hover:border-teal-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
          >
            {timer.status === "running" ? "Pause" : "Resume"}
          </button>
        )}
        {timer.status !== "idle" && (
          <button type="button" onClick={timer.reset} className="min-h-11 rounded-xl border border-slate-700 px-5 text-sm font-medium text-slate-200 hover:border-teal-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400">
            Reset
          </button>
        )}
      </div>
      <p role="status" className="min-h-5 text-sm text-teal-200">
        {done ? "That's a minute of grounding. Notice how you're doing right now, whatever that is." : ""}
      </p>
    </div>
  );
}

export default function DistortionBreakdown({ result, source, onNewReflection, headingRef }: DistortionBreakdownProps) {
  return (
    <section aria-labelledby="results-heading" className="space-y-5">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg shadow-black/20 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="results-heading" ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-slate-50 focus:outline-none">
            Your reflection
          </h2>
          <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300">
            {source === "demo" ? "Demo example" : "AI-generated reflection"}
          </span>
        </div>

        <div className="mt-5 space-y-3">
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Possible thought pattern</p>
          <span className="inline-flex rounded-full bg-teal-500/15 px-3.5 py-1.5 text-sm font-semibold text-teal-200 ring-1 ring-teal-400/30">
            {result.primary_distortion_name}
          </span>
          <p className="max-w-prose leading-relaxed text-slate-300">{result.distortion_explanation}</p>
        </div>

        <div className="mt-6">
          <DistressGauge score={result.panic_intensity_score} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <EvidenceColumn
          title="Objective Facts"
          tone="fact"
          items={result.objective_facts}
          emptyText="There isn't enough concrete detail here to list observable facts — and that's okay. Noticing what you actually know versus what you fear is a useful step on its own."
        />
        <EvidenceColumn
          title="Anxious Assumptions"
          tone="assumption"
          items={result.anxious_assumptions}
          emptyText="No specific predictions or assumptions stood out in what you wrote."
        />
      </div>

      <div className="rounded-2xl border border-teal-500/30 bg-slate-900 p-6 sm:p-8">
        <h3 className="flex items-center gap-2 text-base font-semibold text-teal-200">
          <LeafIcon /> Grounded Reframe
        </h3>
        <p className="mt-3 max-w-prose text-lg leading-relaxed text-slate-100">{result.grounded_reframe}</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-100">
          <FootprintsIcon /> Optional: one minute of grounding
        </h3>
        <p className="mt-3 max-w-prose leading-relaxed text-slate-300">{result.micro_grounding_action}</p>
        <GroundingTimer />
      </div>

      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={onNewReflection}
          className="min-h-12 rounded-xl border border-slate-700 bg-slate-900 px-6 text-base font-medium text-slate-100 hover:border-teal-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
        >
          Start a new reflection
        </button>
      </div>
    </section>
  );
}
