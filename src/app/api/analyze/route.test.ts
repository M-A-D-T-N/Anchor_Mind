// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_FIXTURES, getPreset } from "@/lib/presets";
import type { AnalysisResult, AnalyzeResponse } from "@/types/analysis";

const mocks = vi.hoisted(() => ({
  generateContent: vi.fn(),
  constructed: vi.fn(),
}));

vi.mock("@google/genai", () => {
  class GoogleGenAI {
    models = { generateContent: mocks.generateContent };
    constructor(opts: unknown) {
      mocks.constructed(opts);
    }
  }
  const Type = { OBJECT: "OBJECT", ARRAY: "ARRAY", STRING: "STRING", INTEGER: "INTEGER", BOOLEAN: "BOOLEAN" };
  return { GoogleGenAI, Type };
});

const { POST } = await import("./route");

function makeRequest(body: unknown, init: { contentType?: string; raw?: string } = {}) {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: { "content-type": init.contentType ?? "application/json" },
    body: init.raw ?? JSON.stringify(body),
  });
}

async function call(body: unknown, init?: { contentType?: string; raw?: string }) {
  const res = await POST(makeRequest(body, init));
  return { res, json: (await res.json()) as AnalyzeResponse };
}

const valid: AnalysisResult = {
  is_crisis: false,
  panic_intensity_score: 6,
  trigger_breathing_first: false,
  primary_distortion_name: "Fortune Telling",
  distortion_explanation: "You're predicting a specific outcome.",
  objective_facts: ["You reported a meeting tomorrow."],
  anxious_assumptions: ["It will go badly."],
  grounded_reframe: "You can prepare without knowing the outcome.",
  micro_grounding_action: "Press your feet into the floor for a minute.",
};

function geminiReturns(payload: unknown, extra: Record<string, unknown> = {}) {
  mocks.generateContent.mockResolvedValueOnce({
    text: typeof payload === "string" ? payload : JSON.stringify(payload),
    candidates: [{ finishReason: "STOP" }],
    ...extra,
  });
}

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("DEMO_MODE", "false");
  vi.stubEnv("GEMINI_MODEL", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  mocks.generateContent.mockReset();
  mocks.constructed.mockReset();
});

describe("request validation", () => {
  it("rejects non-JSON content types", async () => {
    const { res, json } = await call(null, { contentType: "text/plain", raw: "hello" });
    expect(res.status).toBe(415);
    expect(json.kind).toBe("error");
  });

  it("rejects malformed JSON", async () => {
    const { res, json } = await call(null, { raw: "{not json" });
    expect(res.status).toBe(400);
    expect(json).toMatchObject({ kind: "error", error: { code: "invalid_json" } });
  });

  it("rejects empty and whitespace-only thoughts", async () => {
    expect((await call({ thought: "   " })).res.status).toBe(400);
    expect((await call({})).res.status).toBe(400);
  });

  it("rejects thoughts over 4,000 characters", async () => {
    const { res } = await call({ thought: "a".repeat(4001) });
    expect(res.status).toBe(400);
  });

  it("accepts exactly 4,000 characters", async () => {
    geminiReturns(valid);
    const { res } = await call({ thought: "a".repeat(4000) });
    expect(res.status).toBe(200);
  });

  it("rejects oversized bodies", async () => {
    const { res } = await call(null, { raw: JSON.stringify({ thought: "a", pad: "x".repeat(25_000) }) });
    expect(res.status).toBe(413);
  });

  it("rejects unknown presets and extra properties", async () => {
    expect((await call({ thought: "hi", demoPresetId: "nope" })).res.status).toBe(400);
    expect((await call({ thought: "hi", extra: true })).res.status).toBe(400);
  });

  it("rejects a preset id whose text does not match", async () => {
    const { res, json } = await call({ thought: "something else", demoPresetId: "exam" });
    expect(res.status).toBe(400);
    expect(json).toMatchObject({ error: { code: "preset_mismatch" } });
  });

  it("sets Cache-Control: no-store", async () => {
    const { res } = await call({ thought: "" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("demo / live configuration", () => {
  it("DEMO_MODE=true serves fixtures for presets without calling Gemini", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const { res, json } = await call({ thought: getPreset("ocd").text, demoPresetId: "ocd" });
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ kind: "analysis", source: "demo", result: { panic_intensity_score: 7 } });
    expect(mocks.generateContent).not.toHaveBeenCalled();
  });

  it("DEMO_MODE=true rejects custom thoughts with a clear message", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const { res, json } = await call({ thought: "my own thought" });
    expect(res.status).toBe(403);
    expect(json).toMatchObject({ kind: "error", error: { code: "live_analysis_disabled", retryable: false } });
  });

  it("live mode with a key sends presets to Gemini too", async () => {
    geminiReturns(valid);
    const { json } = await call({ thought: getPreset("social").text, demoPresetId: "social" });
    expect(json).toMatchObject({ kind: "analysis", source: "gemini" });
    expect(mocks.generateContent).toHaveBeenCalledTimes(1);
    const args = mocks.generateContent.mock.calls[0]?.[0] as { model: string; config: Record<string, unknown> };
    expect(args.model).toBe("gemini-4-hydrogen");
    expect(args.config.responseMimeType).toBe("application/json");
    expect(args.config.abortSignal).toBeInstanceOf(AbortSignal);
    expect(mocks.constructed).toHaveBeenCalledWith({ apiKey: "test-key" });
  });

  it("honors GEMINI_MODEL", async () => {
    vi.stubEnv("GEMINI_MODEL", "custom-model");
    geminiReturns(valid);
    await call({ thought: "hello" });
    expect((mocks.generateContent.mock.calls[0]?.[0] as { model: string }).model).toBe("custom-model");
  });

  it("without a key, presets use fixtures", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    for (const id of ["exam", "ocd", "social"] as const) {
      const { json } = await call({ thought: getPreset(id).text, demoPresetId: id });
      expect(json).toEqual({ kind: "analysis", source: "demo", result: DEMO_FIXTURES[id] });
    }
    expect(mocks.constructed).not.toHaveBeenCalled();
  });

  it("without a key, custom thoughts return a configuration error", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const { res, json } = await call({ thought: "custom" });
    expect(res.status).toBe(503);
    expect(json).toMatchObject({ kind: "error", error: { code: "not_configured" } });
    expect(JSON.stringify(json)).not.toContain("test-key");
  });

  it("never falls back to a demo result when a live preset request fails", async () => {
    mocks.generateContent.mockRejectedValueOnce(Object.assign(new Error("boom"), { status: 500 }));
    const { json } = await call({ thought: getPreset("exam").text, demoPresetId: "exam" });
    expect(json.kind).toBe("error");
  });
});

describe("provider output handling", () => {
  it("derives trigger_breathing_first from the score (7 → false, 8 → true)", async () => {
    geminiReturns({ ...valid, panic_intensity_score: 7, trigger_breathing_first: true });
    const a = await call({ thought: "x" });
    expect(a.json).toMatchObject({ result: { trigger_breathing_first: false } });

    geminiReturns({ ...valid, panic_intensity_score: 8, trigger_breathing_first: false });
    const b = await call({ thought: "x" });
    expect(b.json).toMatchObject({ result: { trigger_breathing_first: true } });
  });

  it("returns crisis even when the other fields are malformed", async () => {
    geminiReturns({ is_crisis: true, panic_intensity_score: "very high", objective_facts: 42 });
    const { res, json } = await call({ thought: "x" });
    expect(res.status).toBe(200);
    expect(json).toEqual({ kind: "crisis", source: "gemini" });
  });

  it("returns crisis for truncated output that flags crisis", async () => {
    geminiReturns('{"is_crisis": true, "panic_intensity_score": 10, "primary_dis', {
      candidates: [{ finishReason: "MAX_TOKENS" }],
    });
    const { json } = await call({ thought: "x" });
    expect(json).toEqual({ kind: "crisis", source: "gemini" });
  });

  it("rejects non-crisis output with extra or missing fields", async () => {
    geminiReturns({ ...valid, extra_field: "nope" });
    expect((await call({ thought: "x" })).res.status).toBe(502);
    const { grounded_reframe: _omit, ...missing } = valid;
    void _omit;
    geminiReturns(missing);
    expect((await call({ thought: "x" })).res.status).toBe(502);
  });

  it("rejects out-of-range and non-integer scores", async () => {
    for (const score of [0, 11, 6.5]) {
      geminiReturns({ ...valid, panic_intensity_score: score });
      const { json } = await call({ thought: "x" });
      expect(json).toMatchObject({ kind: "error", error: { code: "invalid_model_output", retryable: true } });
    }
  });

  it("rejects empty explanatory text but allows empty fact lists", async () => {
    geminiReturns({ ...valid, grounded_reframe: "  " });
    expect((await call({ thought: "x" })).res.status).toBe(502);
    geminiReturns({ ...valid, objective_facts: [], anxious_assumptions: [] });
    expect((await call({ thought: "x" })).res.status).toBe(200);
  });

  it("handles empty, invalid JSON, truncated, and blocked responses", async () => {
    geminiReturns("");
    expect((await call({ thought: "x" })).json).toMatchObject({ error: { code: "empty_model_output" } });
    geminiReturns("not json at all");
    expect((await call({ thought: "x" })).json).toMatchObject({ error: { code: "invalid_model_output" } });
    geminiReturns('{"is_crisis": false, "panic', { candidates: [{ finishReason: "MAX_TOKENS" }] });
    expect((await call({ thought: "x" })).json).toMatchObject({ error: { code: "truncated_model_output" } });
    mocks.generateContent.mockResolvedValueOnce({ text: undefined, promptFeedback: { blockReason: "SAFETY" } });
    const blocked = await call({ thought: "x" });
    expect(blocked.res.status).toBe(422);
    expect(blocked.json).toMatchObject({ error: { code: "content_blocked", retryable: false } });
  });
});

describe("provider failures", () => {
  it.each([
    [{ status: 429 }, 429, "rate_limited"],
    [{ status: 404 }, 502, "model_unavailable"],
    [{ status: 503 }, 503, "provider_unavailable"],
    [{ status: 403 }, 502, "provider_auth"],
  ])("maps %o to %i %s without leaking details", async (extra, status, code) => {
    mocks.generateContent.mockRejectedValueOnce(Object.assign(new Error("raw secret provider detail test-key"), extra));
    const { res, json } = await call({ thought: "x" });
    expect(res.status).toBe(status);
    expect(json).toMatchObject({ kind: "error", error: { code } });
    expect(JSON.stringify(json)).not.toContain("raw secret");
    expect(JSON.stringify(json)).not.toContain("test-key");
  });

  it("maps timeouts to 504", async () => {
    mocks.generateContent.mockRejectedValueOnce(new DOMException("The operation timed out.", "TimeoutError"));
    const { res, json } = await call({ thought: "x" });
    expect(res.status).toBe(504);
    expect(json).toMatchObject({ error: { code: "timeout", retryable: true } });
  });
});
