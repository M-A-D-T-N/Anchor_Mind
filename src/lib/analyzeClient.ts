import { parseAnalyzeResponse } from "@/lib/schemas";
import type { AnalyzeRequest, AnalyzeResponse } from "@/types/analysis";

/** Browser-side call to our own API route. Never talks to Gemini directly. */
export async function requestAnalysis(body: AnalyzeRequest, signal: AbortSignal): Promise<AnalyzeResponse> {
  let res: Response;
  try {
    res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    return {
      kind: "error",
      error: { code: "network_error", message: "We couldn't reach AnchorMind. Check your connection and try again.", retryable: true },
    };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    data = null;
  }

  const parsed = parseAnalyzeResponse(data);
  if (parsed) return parsed;
  return {
    kind: "error",
    error: { code: "unexpected_response", message: "We received an unexpected response. Please try again.", retryable: true },
  };
}
