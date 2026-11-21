import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { LIMITS } from "@/lib/schemas";
import {
  AnalyzeError,
  buildUserContent,
  chooseRoute,
  demoResponse,
  errorResponse,
  jsonResponse,
  mapProviderError,
  parseAnalyzeRequest,
  processProviderOutput,
  readServerConfig,
  REQUEST_TIMEOUT_MS,
  SYSTEM_INSTRUCTION,
} from "@/lib/server/analyze";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const textList = (description: string): Schema => ({
  type: Type.ARRAY,
  description,
  maxItems: String(LIMITS.listItems),
  items: { type: Type.STRING, maxLength: String(LIMITS.listItemChars) },
});

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    is_crisis: {
      type: Type.BOOLEAN,
      description:
        "True only if the text expresses self-harm or suicide intent, plans, intent to harm others, or acute danger needing immediate human support. Intrusive unwanted thoughts or high anxiety alone are not crisis.",
    },
    panic_intensity_score: {
      type: Type.INTEGER,
      minimum: 1,
      maximum: 10,
      description: "Estimated distress expressed in the text, integer 1-10. An AI estimate, not a clinical assessment.",
    },
    trigger_breathing_first: {
      type: Type.BOOLEAN,
      description: "True only if panic_intensity_score is 8 or higher.",
    },
    primary_distortion_name: {
      type: Type.STRING,
      maxLength: String(LIMITS.distortionName),
      description:
        "Best-fit possible thought pattern: Catastrophizing, Mind Reading, Emotional Reasoning, All-or-Nothing Thinking, Fortune Telling, OCD Uncertainty Loop, Overgeneralization, or Unclear / not enough information.",
    },
    distortion_explanation: {
      type: Type.STRING,
      maxLength: String(LIMITS.explanation),
      description: "At most two short, tentative sentences explaining how the pattern shows up in this thought.",
    },
    objective_facts: textList(
      "Only observable events the user actually described, phrased as reported information. No feelings, predictions, or mind-reading. Empty if none.",
    ),
    anxious_assumptions: textList("Predictions, interpretations, mind-reading, or feared outcomes in the thought. Empty if none."),
    grounded_reframe: {
      type: Type.STRING,
      maxLength: String(LIMITS.reframe),
      description: "At most two short sentences of balanced perspective that allows uncertainty. No false reassurance or promises.",
    },
    micro_grounding_action: {
      type: Type.STRING,
      maxLength: String(LIMITS.action),
      description: "One optional, accessible ~60-second physical grounding action. Must not involve checking or reassurance seeking.",
    },
  },
  required: [
    "is_crisis",
    "panic_intensity_score",
    "trigger_breathing_first",
    "primary_distortion_name",
    "distortion_explanation",
    "objective_facts",
    "anxious_assumptions",
    "grounded_reframe",
    "micro_grounding_action",
  ],
  propertyOrdering: [
    "is_crisis",
    "panic_intensity_score",
    "trigger_breathing_first",
    "primary_distortion_name",
    "distortion_explanation",
    "objective_facts",
    "anxious_assumptions",
    "grounded_reframe",
    "micro_grounding_action",
  ],
};

async function analyzeWithGemini(thought: string, model: string) {
  // Created lazily, only after configuration has been checked.
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model,
    contents: buildUserContent(thought),
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.4,
      maxOutputTokens: 2048,
      abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      // One attempt only: no automatic retries beyond the deadline.
      httpOptions: { timeout: REQUEST_TIMEOUT_MS, retryOptions: { attempts: 1 } },
    },
  });

  const candidate = response.candidates?.[0];
  return processProviderOutput({
    text: response.text,
    finishReason: candidate?.finishReason,
    blockReason: response.promptFeedback?.blockReason,
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await parseAnalyzeRequest(request);
    const config = readServerConfig();
    const route = chooseRoute(body, config);

    if (route.kind === "demo") return jsonResponse(demoResponse(route.presetId));

    try {
      return jsonResponse(await analyzeWithGemini(body.thought, config.model));
    } catch (err) {
      const mapped = mapProviderError(err);
      // Log only the error category — never the thought, output, or provider message.
      console.error(`[analyze] provider request failed: ${mapped.code}`);
      throw mapped;
    }
  } catch (err) {
    if (err instanceof AnalyzeError) return errorResponse(err);
    console.error("[analyze] unexpected server error");
    return errorResponse(new AnalyzeError(500, "internal_error", "Something went wrong on our side. Please try again.", true));
  }
}
