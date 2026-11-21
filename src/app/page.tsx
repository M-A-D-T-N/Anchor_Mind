"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BreathingPacerGate, CrisisAlertBanner } from "@/components/BreathingPacerGate";
import DistortionBreakdown from "@/components/DistortionBreakdown";
import { AlertIcon, AnchorIcon, LifebuoyIcon } from "@/components/icons";
import ThoughtInputPanel from "@/components/ThoughtInputPanel";
import { requestAnalysis } from "@/lib/analyzeClient";
import type { AnalysisEnvelope, ApiErrorBody, DemoPresetId, ResultSource } from "@/types/analysis";

type ViewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: ApiErrorBody }
  | { status: "crisis"; source: ResultSource }
  | { status: "breathing"; analysis: AnalysisEnvelope }
  | { status: "results"; analysis: AnalysisEnvelope };

interface LastRequest {
  thought: string;
  demoPresetId?: DemoPresetId;
}

const ANNOUNCEMENTS: Record<ViewState["status"], string> = {
  idle: "",
  loading: "Reflecting on your thought…",
  error: "Something went wrong.",
  crisis: "Support resources are shown.",
  breathing: "A short breathing exercise has started. Your reflection is ready when you are.",
  results: "Your reflection is ready.",
};

export default function Home() {
  const [thought, setThought] = useState("");
  const [view, setView] = useState<ViewState>({ status: "idle" });
  const [manualSupportOpen, setManualSupportOpen] = useState(false);

  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const lastRequestRef = useRef<LastRequest | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const supportButtonRef = useRef<HTMLButtonElement>(null);
  const focusInputNext = useRef(false);

  const cancelInFlight = useCallback(() => {
    requestIdRef.current += 1; // Any late response is now stale.
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Move focus to the heading of whatever just appeared.
  useEffect(() => {
    if (manualSupportOpen || view.status === "crisis" || view.status === "breathing" || view.status === "results" || view.status === "error") {
      headingRef.current?.focus();
    } else if (view.status === "idle" && focusInputNext.current) {
      focusInputNext.current = false;
      textareaRef.current?.focus();
    }
  }, [view.status, manualSupportOpen]);

  const submit = useCallback(
    async (text: string, presetId?: DemoPresetId) => {
      if (view.status === "loading") return; // Prevent duplicate submissions.
      cancelInFlight();
      const id = requestIdRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      const body: LastRequest = presetId ? { thought: text.trim(), demoPresetId: presetId } : { thought: text.trim() };
      lastRequestRef.current = body;
      setManualSupportOpen(false);
      setView({ status: "loading" });

      try {
        const response = await requestAnalysis(body, controller.signal);
        if (id !== requestIdRef.current) return; // Stale response.
        abortRef.current = null;
        if (response.kind === "crisis") {
          setView({ status: "crisis", source: response.source });
        } else if (response.kind === "error") {
          setView({ status: "error", error: response.error });
        } else if (response.result.trigger_breathing_first) {
          setView({ status: "breathing", analysis: response });
        } else {
          setView({ status: "results", analysis: response });
        }
      } catch {
        // Aborted: a newer request or a cancel has already taken over.
      }
    },
    [cancelInFlight, view.status],
  );

  const retry = () => {
    const last = lastRequestRef.current;
    if (last) void submit(last.thought, last.demoPresetId);
  };

  const cancelLoading = () => {
    cancelInFlight();
    setView({ status: "idle" });
  };

  const startNew = () => {
    cancelInFlight();
    setManualSupportOpen(false);
    setThought("");
    focusInputNext.current = true;
    setView({ status: "idle" });
  };

  const finishBreathing = useCallback(() => {
    setView((v) => (v.status === "breathing" ? { status: "results", analysis: v.analysis } : v));
  }, []);

  const closeManualSupport = () => {
    setManualSupportOpen(false);
    requestAnimationFrame(() => supportButtonRef.current?.focus());
  };

  const showInput = !manualSupportOpen && (view.status === "idle" || view.status === "loading" || view.status === "error");
  const announcement = manualSupportOpen ? ANNOUNCEMENTS.crisis : ANNOUNCEMENTS[view.status];

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300">
              <AnchorIcon />
            </span>
            <span className="text-lg font-semibold tracking-tight text-slate-50">AnchorMind</span>
          </div>
          <button
            ref={supportButtonRef}
            type="button"
            onClick={() => setManualSupportOpen(true)}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-rose-400/40 px-3 text-sm font-medium sm:gap-2 sm:px-4 text-rose-200 hover:bg-rose-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
          >
            <LifebuoyIcon width={18} height={18} />
            Get urgent support
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>

        {manualSupportOpen ? (
          <CrisisAlertBanner variant="manual" onClose={closeManualSupport} headingRef={headingRef} />
        ) : view.status === "crisis" ? (
          <CrisisAlertBanner variant="detected" onClose={startNew} headingRef={headingRef} />
        ) : view.status === "breathing" ? (
          <BreathingPacerGate onDone={finishBreathing} headingRef={headingRef} />
        ) : view.status === "results" ? (
          <DistortionBreakdown
            key={view.analysis.result.grounded_reframe + view.analysis.result.panic_intensity_score}
            result={view.analysis.result}
            source={view.analysis.source}
            onNewReflection={startNew}
            headingRef={headingRef}
          />
        ) : null}

        {showInput && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">Pause the spiral.</h1>
              <p className="max-w-prose leading-relaxed text-slate-400">
                Write down the thought that&apos;s looping. AnchorMind offers a short, CBT- and ACT-informed reflection
                to help you separate what you know from what you fear. It&apos;s a supportive tool, not therapy or
                emergency care.
              </p>
            </div>

            {view.status === "error" && (
              <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
                <AlertIcon className="mt-0.5 shrink-0 text-amber-300" />
                <div className="space-y-3">
                  <h2 ref={headingRef} tabIndex={-1} className="font-semibold text-amber-100 focus:outline-none">
                    We couldn&apos;t complete that reflection
                  </h2>
                  <p className="text-sm leading-relaxed text-slate-300">{view.error.message}</p>
                  {view.error.retryable && (
                    <button
                      type="button"
                      onClick={retry}
                      className="min-h-11 rounded-xl bg-amber-400 px-5 text-sm font-semibold text-slate-950 hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-black/20 sm:p-8">
              <ThoughtInputPanel
                value={thought}
                onChange={setThought}
                onSubmit={(text, presetId) => void submit(text, presetId)}
                loading={view.status === "loading"}
                textareaRef={textareaRef}
              />
              {view.status === "loading" && (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={cancelLoading}
                    className="min-h-11 rounded-xl px-4 text-sm font-medium text-slate-400 underline underline-offset-4 hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="mx-auto max-w-3xl px-4 pb-10 text-xs leading-relaxed text-slate-500 sm:px-6">
        AnchorMind is a supportive reflection tool. It is not clinically validated, does not diagnose, and is not a
        substitute for professional care or emergency services. Thoughts are not stored by AnchorMind.
      </footer>
    </div>
  );
}
