import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_FIXTURES } from "@/lib/presets";
import { BreathingPacerGate, breathingStateAt, BREATHING_TOTAL_MS } from "./BreathingPacerGate";
import DistortionBreakdown from "./DistortionBreakdown";
import ThoughtInputPanel from "./ThoughtInputPanel";

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("breathingStateAt", () => {
  it("follows 4-4-6 phases across three cycles", () => {
    expect(BREATHING_TOTAL_MS).toBe(42_000);
    expect(breathingStateAt(0)).toMatchObject({ cycle: 1, phase: { key: "inhale" }, remainingSeconds: 4 });
    expect(breathingStateAt(4_000)).toMatchObject({ phase: { key: "hold" } });
    expect(breathingStateAt(8_000)).toMatchObject({ phase: { key: "exhale" }, remainingSeconds: 6 });
    expect(breathingStateAt(14_000)).toMatchObject({ cycle: 2, phase: { key: "inhale" } });
    expect(breathingStateAt(41_999)).toMatchObject({ cycle: 3, phase: { key: "exhale" } });
  });
});

describe("BreathingPacerGate", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("completes once after 42 seconds", () => {
    const onDone = vi.fn();
    render(<BreathingPacerGate onDone={onDone} />);
    expect(screen.getByText("Breathe in")).toBeInTheDocument();
    advance(4_100);
    expect(screen.getByText("Hold gently")).toBeInTheDocument();
    advance(4_000);
    expect(screen.getByText("Breathe out slowly")).toBeInTheDocument();
    advance(BREATHING_TOTAL_MS);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith("completed");
    advance(10_000);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("pauses without progressing, then resumes", () => {
    const onDone = vi.fn();
    render(<BreathingPacerGate onDone={onDone} />);
    advance(2_000);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    advance(60_000);
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByText("Paused")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    advance(39_000);
    expect(onDone).not.toHaveBeenCalled();
    advance(1_200);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("restart returns to the beginning", () => {
    const onDone = vi.fn();
    render(<BreathingPacerGate onDone={onDone} />);
    advance(30_000);
    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    advance(200);
    expect(screen.getByText("Breath 1 of 3")).toBeInTheDocument();
    advance(30_000);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("skip calls onDone once and prevents a later completion", () => {
    const onDone = vi.fn();
    render(<BreathingPacerGate onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "Skip and view reflection" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip and view reflection" }));
    advance(BREATHING_TOTAL_MS + 1_000);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith("skipped");
  });
});

describe("DistortionBreakdown grounding timer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const renderIt = () =>
    render(<DistortionBreakdown result={DEMO_FIXTURES.social} source="demo" onNewReflection={() => {}} />);

  it("shows labels, facts, assumptions, and the demo label", () => {
    renderIt();
    expect(screen.getByText("Possible thought pattern")).toBeInTheDocument();
    expect(screen.getByText("Mind Reading")).toBeInTheDocument();
    expect(screen.getByText("Demo example")).toBeInTheDocument();
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "5");
    expect(screen.getByText("Objective Facts")).toBeInTheDocument();
    expect(screen.getByText("Anxious Assumptions")).toBeInTheDocument();
  });

  it("shows empty states when evidence is insufficient", () => {
    render(
      <DistortionBreakdown
        result={{ ...DEMO_FIXTURES.social, objective_facts: [], anxious_assumptions: [] }}
        source="gemini"
        onNewReflection={() => {}}
      />,
    );
    expect(screen.getByText(/isn't enough concrete detail/)).toBeInTheDocument();
    expect(screen.getByText("AI-generated reflection")).toBeInTheDocument();
  });

  it("runs, pauses, resumes, completes, and resets", () => {
    renderIt();
    fireEvent.click(screen.getByRole("button", { name: "Start 60-second timer" }));
    advance(10_000);
    expect(screen.getByText("0:50")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    advance(30_000);
    expect(screen.getByText("0:50")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    advance(50_100);
    expect(screen.getByText(/That's a minute of grounding/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("1:00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start 60-second timer" })).toBeInTheDocument();
  });
});

describe("ThoughtInputPanel", () => {
  it("submits the exact preset text immediately", () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();
    render(<ThoughtInputPanel value="" onChange={onChange} onSubmit={onSubmit} loading={false} />);
    fireEvent.click(screen.getByRole("button", { name: "OCD Checking Loop" }));
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining("stove"));
    expect(onSubmit).toHaveBeenCalledWith(expect.stringContaining("stove"), "ocd");
  });

  it("shows inline validation for empty input", () => {
    const onSubmit = vi.fn();
    render(<ThoughtInputPanel value="  " onChange={() => {}} onSubmit={onSubmit} loading={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Find my anchor" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/write a thought/);
    expect(screen.getByLabelText("What's on your mind?")).toHaveAttribute("aria-invalid", "true");
  });

  it("disables voice input gracefully when unsupported", () => {
    render(<ThoughtInputPanel value="" onChange={() => {}} onSubmit={() => {}} loading={false} />);
    expect(screen.getByRole("button", { name: "Dictate" })).toBeDisabled();
    expect(screen.getByText(/Voice input isn't available/)).toBeInTheDocument();
  });
});
