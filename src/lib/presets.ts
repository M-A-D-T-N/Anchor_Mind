import type { AnalysisResult, DemoPresetId } from "@/types/analysis";

export interface DemoPreset {
  id: DemoPresetId;
  name: string;
  text: string;
}

export const DEMO_PRESETS: readonly DemoPreset[] = [
  {
    id: "exam",
    name: "Exam & Presentation Spiral",
    text: "I have a big exam and a presentation tomorrow. My heart is racing and I keep thinking I'm going to completely fail both, freeze in front of everyone, and ruin everything I've worked for.",
  },
  {
    id: "ocd",
    name: "OCD Checking Loop",
    text: "I already checked that the stove is off, but I feel like I have to go back and check it again. I can't stop until I'm completely, 100% certain nothing bad will happen.",
  },
  {
    id: "social",
    name: "Social Message Overthink",
    text: "I sent my friend a message hours ago and they still haven't replied. They must be angry with me about something I said.",
  },
] as const;

export function getPreset(id: DemoPresetId): DemoPreset {
  const preset = DEMO_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Unknown preset: ${id}`);
  return preset;
}

/**
 * Deterministic demo fixtures. They are validated through the same strict
 * schema as live output (see tests and the API route).
 */
export const DEMO_FIXTURES: Record<DemoPresetId, AnalysisResult> = {
  exam: {
    is_crisis: false,
    panic_intensity_score: 9,
    trigger_breathing_first: true,
    primary_distortion_name: "Catastrophizing",
    distortion_explanation:
      "Your mind is jumping from a real, demanding day to the worst possible outcome. A racing heart can make that prediction feel like a certainty, even though it hasn't happened.",
    objective_facts: [
      "You reported having an exam tomorrow.",
      "You reported having a presentation tomorrow.",
      "You reported that your heart is racing right now.",
    ],
    anxious_assumptions: [
      "You will completely fail both.",
      "You will freeze in front of everyone.",
      "One difficult day will ruin everything you've worked for.",
    ],
    grounded_reframe:
      "Tomorrow matters to you, and that is why this feels so intense. You don't have to know how it will go to take the next small step tonight.",
    micro_grounding_action:
      "Press both feet into the floor and notice five things you can see around you, naming each one slowly. If it's comfortable, let your shoulders drop on each name.",
  },
  ocd: {
    is_crisis: false,
    panic_intensity_score: 7,
    trigger_breathing_first: false,
    primary_distortion_name: "OCD Uncertainty Loop",
    distortion_explanation:
      "The urge to check again is asking for a level of certainty that no check can provide. Each extra check tends to make the doubt louder rather than quieter.",
    objective_facts: ["You reported that you already checked the stove once."],
    anxious_assumptions: [
      "You need to be 100% certain before you can stop.",
      "Something bad will happen unless you check again.",
    ],
    grounded_reframe:
      "This feeling of doubt is uncomfortable, and it's also a familiar pattern rather than new information. You can notice the urge and let it be here without answering it.",
    micro_grounding_action:
      "Wherever you are, rest one hand on your chest and slowly trace the outline of your other hand with a fingertip, from thumb to little finger and back. Let the urge be present while your attention stays with the sensation.",
  },
  social: {
    is_crisis: false,
    panic_intensity_score: 5,
    trigger_breathing_first: false,
    primary_distortion_name: "Mind Reading",
    distortion_explanation:
      "You're filling a silence with a specific explanation about your friend's feelings. A delayed reply has many possible reasons that you can't see from here.",
    objective_facts: [
      "You reported sending your friend a message.",
      "You reported that a few hours have passed without a reply.",
    ],
    anxious_assumptions: ["Your friend is angry with you.", "Something you said caused a problem."],
    grounded_reframe:
      "It makes sense to care about how your friend feels. Right now you know the message is unanswered, not why, and you can hold that uncertainty for a while.",
    micro_grounding_action:
      "Put your phone face down, then slowly squeeze and release your hands five times, noticing the warmth and tension in your palms. Finish by naming one sound you can hear.",
  },
};
