import { z } from "zod";
import type { AnalysisResult, AnalyzeResponse } from "@/types/analysis";

export const THOUGHT_MAX_CHARS = 4000;
/** Hard cap on the raw request body (bytes). Generous for 4,000 multi-byte characters plus JSON overhead. */
export const MAX_BODY_BYTES = 20_000;
export const BREATHING_THRESHOLD = 8;

export const LIMITS = {
  distortionName: 60,
  explanation: 400,
  listItems: 6,
  listItemChars: 300,
  reframe: 400,
  action: 400,
} as const;

const nonEmptyText = (max: number) => z.string().trim().min(1).max(max);

export const demoPresetIdSchema = z.enum(["exam", "ocd", "social"]);

export const analyzeRequestSchema = z.strictObject({
  thought: z
    .string({ error: "Please enter a thought to reflect on." })
    .trim()
    .min(1, { error: "Please enter a thought to reflect on." })
    .max(THOUGHT_MAX_CHARS, { error: `Please keep it under ${THOUGHT_MAX_CHARS.toLocaleString("en-US")} characters.` }),
  demoPresetId: demoPresetIdSchema.optional(),
});

const factList = z.array(z.string().trim().min(1).max(LIMITS.listItemChars)).max(LIMITS.listItems);

/**
 * Strict validation for a non-crisis analysis. All nine fields are required,
 * extra properties are rejected, and explanatory text must be non-empty.
 * Facts and assumptions may be empty when evidence is insufficient.
 */
export const analysisResultSchema = z.strictObject({
  is_crisis: z.literal(false),
  panic_intensity_score: z.int().min(1).max(10),
  trigger_breathing_first: z.boolean(),
  primary_distortion_name: nonEmptyText(LIMITS.distortionName),
  distortion_explanation: nonEmptyText(LIMITS.explanation),
  objective_facts: factList,
  anxious_assumptions: factList,
  grounded_reframe: nonEmptyText(LIMITS.reframe),
  micro_grounding_action: nonEmptyText(LIMITS.action),
});

/** Never trust the model to keep the gate flag consistent with the score. */
export function deriveBreathingGate(result: AnalysisResult): AnalysisResult {
  return { ...result, trigger_breathing_first: result.panic_intensity_score >= BREATHING_THRESHOLD };
}

export type ValidatedAnalysis =
  | { ok: true; result: AnalysisResult }
  | { ok: false; issues: string[] };

export function validateAnalysis(value: unknown): ValidatedAnalysis {
  const parsed = analysisResultSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.code}`) };
  }
  return { ok: true, result: deriveBreathingGate(parsed.data) };
}

/** True when a parsed value is an object explicitly flagging crisis. */
export function isCrisisFlagged(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value) && (value as Record<string, unknown>).is_crisis === true;
}

/* ---------- Client-side response envelope validation ---------- */

const errorEnvelopeSchema = z.strictObject({
  kind: z.literal("error"),
  error: z.strictObject({
    code: z.string().max(64),
    message: z.string().max(500),
    retryable: z.boolean(),
  }),
});

const responseSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("analysis"), source: z.enum(["gemini", "demo"]), result: analysisResultSchema }),
  z.strictObject({ kind: z.literal("crisis"), source: z.enum(["gemini", "demo"]) }),
  errorEnvelopeSchema,
]);

export function parseAnalyzeResponse(value: unknown): AnalyzeResponse | null {
  // Crisis takes priority even if something else in the envelope is odd.
  if (typeof value === "object" && value !== null && (value as Record<string, unknown>).kind === "crisis") {
    const source = (value as Record<string, unknown>).source === "gemini" ? "gemini" : "demo";
    return { kind: "crisis", source };
  }
  const parsed = responseSchema.safeParse(value);
  if (!parsed.success) return null;
  if (parsed.data.kind === "analysis") {
    return { ...parsed.data, result: deriveBreathingGate(parsed.data.result) };
  }
  return parsed.data;
}
