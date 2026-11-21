import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_FIXTURES } from "@/lib/presets";
import type { AnalyzeResponse } from "@/types/analysis";
import Home from "./page";

function jsonResponse(body: AnalyzeResponse, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function typeAndSubmit(text: string) {
  fireEvent.change(screen.getByLabelText("What's on your mind?"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Find my anchor" }));
}

describe("Home page flow", () => {
  it("shows crisis support immediately, never the breathing gate or analysis", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ kind: "crisis", source: "gemini" })));
    render(<Home />);
    typeAndSubmit("something");
    expect(await screen.findByRole("heading", { name: /may need support right now/ })).toBeInTheDocument();
    expect(screen.queryByText(/slow things down/)).not.toBeInTheDocument();
    expect(screen.queryByText("Possible thought pattern")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /findahelpline/ })).toHaveAttribute("href", "https://findahelpline.com");
  });

  it("score 8+ opens the breathing gate and hides results until skip", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ kind: "analysis", source: "demo", result: DEMO_FIXTURES.exam })));
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "Exam & Presentation Spiral" }));
    expect(await screen.findByText(/slow things down/)).toBeInTheDocument();
    expect(screen.queryByText("Possible thought pattern")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Skip and view reflection" }));
    expect(screen.getByText("Catastrophizing")).toBeInTheDocument();
  });

  it("score 7 skips the gate", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ kind: "analysis", source: "demo", result: DEMO_FIXTURES.ocd })));
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "OCD Checking Loop" }));
    expect(await screen.findByText("OCD Uncertainty Loop")).toBeInTheDocument();
    expect(screen.queryByText(/slow things down/)).not.toBeInTheDocument();
  });

  it("sends the exact preset text and id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ kind: "analysis", source: "demo", result: DEMO_FIXTURES.social }));
    vi.stubGlobal("fetch", fetchMock);
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "Social Message Overthink" }));
    await screen.findByText("Mind Reading");
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as { thought: string; demoPresetId: string };
    expect(body.demoPresetId).toBe("social");
    expect(body.thought).toMatch(/haven't replied/);
  });

  it("keeps text after an error and retries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ kind: "error", error: { code: "timeout", message: "Took too long.", retryable: true } }, 504))
      .mockResolvedValueOnce(jsonResponse({ kind: "analysis", source: "gemini", result: DEMO_FIXTURES.social }));
    vi.stubGlobal("fetch", fetchMock);
    render(<Home />);
    typeAndSubmit("my thought");
    expect(await screen.findByText("Took too long.")).toBeInTheDocument();
    expect(screen.getByLabelText("What's on your mind?")).toHaveValue("my thought");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("AI-generated reflection")).toBeInTheDocument();
  });

  it("hides Retry for non-retryable errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ kind: "error", error: { code: "not_configured", message: "Not set up.", retryable: false } }, 503)),
    );
    render(<Home />);
    typeAndSubmit("custom");
    expect(await screen.findByText("Not set up.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("ignores a late response after cancel", async () => {
    let resolveFetch: (r: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Promise<Response>((resolve) => (resolveFetch = resolve))),
    );
    render(<Home />);
    typeAndSubmit("slow one");
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await act(async () => {
      resolveFetch(jsonResponse({ kind: "analysis", source: "gemini", result: DEMO_FIXTURES.social }));
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Find my anchor" })).toBeEnabled());
    expect(screen.queryByText("Mind Reading")).not.toBeInTheDocument();
  });

  it("opens urgent support manually without any API call", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "Get urgent support" }));
    expect(screen.getByRole("heading", { name: "Get urgent support" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText("What's on your mind?")).toBeInTheDocument();
  });
});
