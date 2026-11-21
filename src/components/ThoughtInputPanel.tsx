"use client";

import { useCallback, useId, useState, type FormEvent, type Ref } from "react";
import { DEMO_PRESETS } from "@/lib/presets";
import { THOUGHT_MAX_CHARS } from "@/lib/schemas";
import { appendTranscript, useSpeechRecognition } from "@/lib/useSpeechRecognition";
import type { DemoPresetId } from "@/types/analysis";
import { MicIcon, StopIcon } from "./icons";

export interface ThoughtInputPanelProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (text: string, presetId?: DemoPresetId) => void;
  loading: boolean;
  textareaRef?: Ref<HTMLTextAreaElement>;
}

export function validateThought(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return "Please write a thought first — even a few words is enough.";
  if (trimmed.length > THOUGHT_MAX_CHARS) {
    return `Please shorten this to ${THOUGHT_MAX_CHARS.toLocaleString("en-US")} characters or fewer.`;
  }
  return null;
}

export default function ThoughtInputPanel({ value, onChange, onSubmit, loading, textareaRef }: ThoughtInputPanelProps) {
  const ids = { field: useId(), error: useId(), count: useId(), privacy: useId() };
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleFinalSpeech = useCallback(
    (text: string) => {
      onChange(appendTranscript(value, text));
    },
    [onChange, value],
  );
  const speech = useSpeechRecognition(handleFinalSpeech);

  const length = value.trim().length;
  const overLimit = length > THOUGHT_MAX_CHARS;
  const shownError = validationError ?? (overLimit ? validateThought(value) : null);

  const submitText = (text: string, presetId?: DemoPresetId) => {
    if (loading) return;
    speech.stop();
    const problem = validateThought(text);
    setValidationError(problem);
    if (problem) return;
    onSubmit(text, presetId);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitText(value);
  };

  const handlePreset = (presetId: DemoPresetId, text: string) => {
    if (loading) return;
    onChange(text);
    // Pass the exact text directly to avoid submitting stale state.
    submitText(text, presetId);
  };

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={loading} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor={ids.field} className="block text-base font-medium text-slate-100">
          What&apos;s on your mind?
        </label>
        <textarea
          id={ids.field}
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (validationError) setValidationError(null);
          }}
          rows={5}
          disabled={loading}
          placeholder="Take your time. Describe the thought as it shows up — for example, “What if I mess this up and everyone notices?”"
          aria-invalid={shownError ? true : undefined}
          aria-describedby={`${ids.count} ${ids.privacy}${shownError ? ` ${ids.error}` : ""}`}
          className="block w-full resize-y rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-base leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/40 disabled:opacity-60 aria-invalid:border-amber-400"
        />
        <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
          <p id={ids.error} role={shownError ? "alert" : undefined} className="min-h-5 text-amber-300">
            {shownError}
          </p>
          <p id={ids.count} className={overLimit ? "text-amber-300" : "text-slate-400"}>
            {length.toLocaleString("en-US")} / {THOUGHT_MAX_CHARS.toLocaleString("en-US")}
            <span className="sr-only"> characters</span>
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={speech.listening ? speech.stop : speech.start}
            disabled={loading || !speech.supported}
            aria-pressed={speech.listening}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-700 bg-slate-800/60 px-4 text-sm font-medium text-slate-200 transition-colors hover:border-teal-500 hover:text-teal-200 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
          >
            {speech.listening ? <StopIcon /> : <MicIcon />}
            {speech.listening ? "Stop dictation" : "Dictate"}
          </button>
          {speech.listening && (
            <span className="text-sm text-teal-300" role="status">
              Listening… speak naturally, then press stop.
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">
          {speech.supported
            ? "Dictation uses your browser's speech recognition, which may send audio to an external provider (for example, your browser vendor)."
            : "Voice input isn't available in this browser — typing works just as well."}
        </p>
        {speech.error && (
          <p role="alert" className="text-sm text-amber-300">
            {speech.error}
          </p>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-300">Or try an example</legend>
        <div className="flex flex-wrap gap-2">
          {DEMO_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handlePreset(preset.id, preset.text)}
              disabled={loading}
              className="min-h-11 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 transition-colors hover:border-teal-500 hover:text-teal-200 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-3 border-t border-slate-800 pt-5">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-500 px-6 text-base font-semibold text-slate-950 shadow-sm shadow-teal-950/40 transition-colors hover:bg-teal-400 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300 sm:w-auto"
        >
          {loading && (
            <span
              aria-hidden="true"
              className="h-4 w-4 rounded-full border-2 border-slate-950/30 border-t-slate-950 motion-safe:animate-spin"
            />
          )}
          {loading ? "Finding your anchor…" : "Find my anchor"}
        </button>
        <p id={ids.privacy} className="text-xs leading-relaxed text-slate-500">
          Live analysis sends the text you enter to Google&apos;s Gemini API for processing; Google&apos;s own terms
          govern how it handles that data. AnchorMind doesn&apos;t save your thoughts or reflections.
        </p>
      </div>
    </form>
  );
}
