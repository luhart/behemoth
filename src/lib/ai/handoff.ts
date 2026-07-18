import "server-only";

import { anthropic } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";

import type { DemoScenario } from "@/lib/demo/fixtures";
import { HandoffSchema, type ClinicalHandoff, type Evidence } from "@/lib/workflow/contracts";

export type HandoffGeneration = {
  handoff: ClinicalHandoff;
  mode: "live" | "fixture" | "degraded";
};

export async function generateClinicalHandoff(input: {
  scenario: DemoScenario;
  evidence: Evidence[];
  preferLive: boolean;
}): Promise<HandoffGeneration> {
  if (!input.preferLive || process.env.AGENT_MODE !== "live" || !process.env.ANTHROPIC_API_KEY) {
    return { handoff: input.scenario.handoff, mode: "fixture" };
  }

  try {
    const { output } = await generateText({
      model: anthropic(process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5"),
      abortSignal: AbortSignal.timeout(10_000),
      maxOutputTokens: 1_200,
      output: Output.object({
        schema: HandoffSchema,
        name: "ClinicalHandoff",
        description: "A concise, evidence-linked pre-visit handoff for clinician review",
      }),
      system: `You prepare a pre-visit handoff, not a diagnosis or treatment plan.
Preserve the patient's own words. Never infer facts that are not in evidence.
Call out contradictions instead of resolving them. Keep the agenda to what fits in one visit.
Use emergency-guidance only when the supplied safety branch already escalated.
Every clinical statement must be supported by an evidence ID. Human review is always required.`,
      prompt: JSON.stringify(
        {
          patient: input.scenario.patient,
          conversation: input.scenario.conversation,
          concerns: input.scenario.concerns,
          evidence: input.evidence,
          deterministicSafetyDisposition: input.scenario.handoff.disposition,
        },
        null,
        2,
      ),
    });
    const allowedEvidenceIds = new Set(input.evidence.map((item) => item.id));
    if (output.evidenceIds.some((id) => !allowedEvidenceIds.has(id))) {
      throw new Error("Model returned an evidence ID that was not supplied.");
    }
    return { handoff: output, mode: "live" };
  } catch {
    return { handoff: input.scenario.handoff, mode: "degraded" };
  }
}
