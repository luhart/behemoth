import "server-only";

import { anthropic } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";
import { z } from "zod";

import { DxSuggestionSchema, type Concern, type DxSuggestions, type Evidence } from "@/lib/workflow/contracts";
import { deterministicDxSuggestions, DX_DISCLAIMER } from "@/lib/workflow/differential";

const DxModelOutputSchema = z.object({
  suggestions: z.array(DxSuggestionSchema).min(1).max(5),
});

export async function generateDxSuggestions(input: {
  concerns: Concern[];
  evidence: Evidence[];
  preferLive: boolean;
}): Promise<DxSuggestions> {
  const fallback = deterministicDxSuggestions(input);
  if (!input.preferLive || process.env.AGENT_MODE !== "live" || !process.env.ANTHROPIC_API_KEY) return fallback;
  if (fallback.suggestions.length === 0 && input.evidence.length === 0) return fallback;

  try {
    const { output } = await generateText({
      model: anthropic(process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5"),
      abortSignal: AbortSignal.timeout(20_000),
      maxOutputTokens: 1_200,
      providerOptions: {
        anthropic: {
          thinking: { type: "disabled" },
          structuredOutputMode: "outputFormat",
        },
      },
      output: Output.object({
        schema: DxModelOutputSchema,
        name: "DxSuggestions",
        description: "ICD-10-CM coded suggestions for clinician consideration, linked to supplied evidence",
      }),
      system: `You surface coding and differential SUGGESTIONS for a clinician to consider before a visit. You never diagnose.
Prefer symptom codes (basis "reported-symptom") that literally restate what the patient reported.
Use basis "chart-history" only for conditions the supplied Athena problem-list evidence already names.
Use basis "differential-consideration" sparingly (at most 2) for common, non-alarming conditions consistent with the evidence; word the label neutrally, without asserting the patient has it.
Every suggestion needs a valid ICD-10-CM code, its official-style descriptor, one to four related symptoms the clinician could ask about, a one-sentence rationale, and one to three supplied evidence IDs.
Never suggest codes for conditions with no supporting evidence. Never propose treatment. Never rank urgency.
Return at most five suggestions.`,
      prompt: JSON.stringify(
        {
          concerns: input.concerns,
          evidence: input.evidence,
          deterministicBaseline: fallback.suggestions,
        },
        null,
        2,
      ),
    });
    const allowedEvidenceIds = new Set(input.evidence.map((item) => item.id));
    if (output.suggestions.some((suggestion) => suggestion.evidenceIds.some((id) => !allowedEvidenceIds.has(id)))) {
      throw new Error("Model cited evidence that was not supplied.");
    }
    const differentialCount = output.suggestions.filter((item) => item.basis === "differential-consideration").length;
    if (differentialCount > 2) throw new Error("Model exceeded the differential-consideration budget.");
    return { suggestions: output.suggestions, method: "sonnet", disclaimer: DX_DISCLAIMER };
  } catch (error) {
    console.warn(
      "Dx suggestion generation degraded to the deterministic symptom-code baseline:",
      error instanceof Error ? error.message : "unknown generation error",
    );
    return fallback;
  }
}
