/**
 * The exact analysis contract returned by the model (after server validation).
 * Exactly nine fields; no metadata is added here.
 */
export interface AnalysisResult {
  is_crisis: boolean;
  panic_intensity_score: number;
  trigger_breathing_first: boolean;
  primary_distortion_name: string;
  distortion_explanation: string;
  objective_facts: string[];
  anxious_assumptions: string[];
  grounded_reframe: string;
  micro_grounding_action: string;
}

export type DemoPresetId = "exam" | "ocd" | "social";

export type ResultSource = "gemini" | "demo";

export interface AnalyzeRequest {
  thought: string;
  demoPresetId?: DemoPresetId;
}

export interface AnalysisEnvelope {
  kind: "analysis";
  source: ResultSource;
  result: AnalysisResult;
}

export interface CrisisEnvelope {
  kind: "crisis";
  source: ResultSource;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  retryable: boolean;
}

export interface ErrorEnvelope {
  kind: "error";
  error: ApiErrorBody;
}

export type AnalyzeResponse = AnalysisEnvelope | CrisisEnvelope | ErrorEnvelope;
