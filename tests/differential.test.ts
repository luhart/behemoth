import { describe, expect, test } from "bun:test";

import { deterministicDxSuggestions, DX_DISCLAIMER } from "../src/lib/workflow/differential";
import { DxSuggestionsSchema, type Concern, type Evidence } from "../src/lib/workflow/contracts";

const patientEvidence: Evidence[] = [
  { id: "patient-chief-complaint", label: "Patient's exact words", value: "Masakit ang ulo ko at nahihilo ako", source: "patient" },
  { id: "patient-confirmed-interpretation", label: "Patient-confirmed English rendering", value: "My head hurts and I feel dizzy", source: "derived" },
];

const athenaProblem: Evidence = {
  id: "athena-live-problem-1",
  label: "Problem list",
  value: "Essential hypertension",
  source: "athena",
};

const concerns: Concern[] = [
  { id: "c1", patientWords: "Masakit ang ulo ko", translated: "My head hurts", duration: null, severity: null, priority: "soon" },
];

describe("deterministic dx suggestions", () => {
  test("maps reported symptoms to ICD-10 symptom codes with patient evidence", () => {
    const result = deterministicDxSuggestions({ concerns, evidence: patientEvidence });
    expect(DxSuggestionsSchema.parse(result)).toEqual(result);
    const codes = result.suggestions.map((item) => item.icd10);
    expect(codes).toContain("R51.9");
    expect(codes).toContain("R42");
    for (const suggestion of result.suggestions) {
      expect(suggestion.basis).toBe("reported-symptom");
      expect(suggestion.evidenceIds).toEqual(["patient-chief-complaint", "patient-confirmed-interpretation"]);
    }
    expect(result.method).toBe("deterministic");
    expect(result.disclaimer).toBe(DX_DISCLAIMER);
  });

  test("codes chart history only when the Athena problem list names it, citing that evidence", () => {
    const result = deterministicDxSuggestions({ concerns, evidence: [...patientEvidence, athenaProblem] });
    const historySuggestion = result.suggestions.find((item) => item.basis === "chart-history");
    expect(historySuggestion?.icd10).toBe("I10");
    expect(historySuggestion?.evidenceIds).toEqual(["athena-live-problem-1"]);
  });

  test("returns no suggestions when nothing in the report or chart matches", () => {
    const quiet = deterministicDxSuggestions({
      concerns: [{ id: "c1", patientWords: "Annual visit", translated: "Annual visit", duration: null, severity: null, priority: "routine" }],
      evidence: [{ id: "patient-chief-complaint", label: "Patient's exact words", value: "Annual visit", source: "patient" }],
    });
    expect(quiet.suggestions).toEqual([]);
  });

  test("caps combined suggestions at five", () => {
    const kitchenSink: Evidence[] = [
      {
        id: "patient-chief-complaint",
        label: "Patient's exact words",
        value: "Headache, dizzy, fever, nausea, stomach pain, cough, tired, cannot hear well",
        source: "patient",
      },
    ];
    const result = deterministicDxSuggestions({ concerns: [], evidence: kitchenSink });
    expect(result.suggestions.length).toBe(5);
  });
});
