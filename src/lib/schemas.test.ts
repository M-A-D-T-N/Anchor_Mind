import { describe, expect, it } from "vitest";
import { DEMO_FIXTURES, DEMO_PRESETS } from "@/lib/presets";
import { analyzeRequestSchema, parseAnalyzeResponse, validateAnalysis } from "@/lib/schemas";

describe("demo fixtures", () => {
  it("are all valid under the strict schema with the expected scores", () => {
    expect(validateAnalysis(DEMO_FIXTURES.exam)).toMatchObject({ ok: true, result: { panic_intensity_score: 9, trigger_breathing_first: true } });
    expect(validateAnalysis(DEMO_FIXTURES.ocd)).toMatchObject({ ok: true, result: { panic_intensity_score: 7, trigger_breathing_first: false } });
    expect(validateAnalysis(DEMO_FIXTURES.social)).toMatchObject({ ok: true, result: { panic_intensity_score: 5, trigger_breathing_first: false } });
  });

  it("have exactly nine fields", () => {
    for (const fixture of Object.values(DEMO_FIXTURES)) expect(Object.keys(fixture)).toHaveLength(9);
  });

  it("preset texts are valid requests", () => {
    for (const p of DEMO_PRESETS) expect(analyzeRequestSchema.safeParse({ thought: p.text, demoPresetId: p.id }).success).toBe(true);
  });
});

describe("client response parsing", () => {
  it("prioritizes crisis envelopes", () => {
    expect(parseAnalyzeResponse({ kind: "crisis", source: "gemini", junk: 1 })).toEqual({ kind: "crisis", source: "gemini" });
  });

  it("rejects unknown shapes", () => {
    expect(parseAnalyzeResponse({ kind: "analysis", source: "gemini", result: { is_crisis: false } })).toBeNull();
    expect(parseAnalyzeResponse("nope")).toBeNull();
  });

  it("re-derives the breathing flag client-side", () => {
    const parsed = parseAnalyzeResponse({ kind: "analysis", source: "demo", result: { ...DEMO_FIXTURES.exam, trigger_breathing_first: false } });
    expect(parsed).toMatchObject({ result: { trigger_breathing_first: true } });
  });
});
