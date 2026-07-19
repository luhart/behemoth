import { describe, expect, test } from "bun:test";

import { scenarios } from "../src/lib/demo/fixtures";
import { HandoffSchema, type AgendaItem, type Evidence } from "../src/lib/workflow/contracts";
import { patientAnchoredAgenda } from "../src/lib/workflow/handoff-evidence";

describe("handoff agenda evidence guard", () => {
  test("removes chart-only agenda additions while retaining patient concerns with chart support", () => {
    const evidence: Evidence[] = [
      { id: "patient-chief-complaint", label: "Patient report", value: "Foot pain", source: "patient" },
      { id: "patient-priority-1", label: "Confirmed priority", value: "Foot pain", source: "derived" },
      { id: "athena-medication-1", label: "Active medication", value: "lisinopril", source: "athena" },
    ];
    const agenda: AgendaItem[] = [
      {
        label: "Evaluate persistent foot pain",
        rationale: "The patient selected this concern.",
        evidenceIds: ["patient-priority-1"],
      },
      {
        label: "Review a patient concern with chart support",
        rationale: "Patient and chart evidence both support review.",
        evidenceIds: ["patient-chief-complaint", "athena-medication-1"],
      },
      {
        label: "Speculate about lisinopril and the foot-pain presentation",
        rationale: "This chart-only addition is not anchored to the patient's report.",
        evidenceIds: ["athena-medication-1"],
      },
    ];

    expect(patientAnchoredAgenda(agenda, evidence).map((item) => item.label)).toEqual([
      "Evaluate persistent foot pain",
      "Review a patient concern with chart support",
    ]);
  });

  test("rejects agenda evidence that is absent from global handoff evidence", () => {
    const handoff = scenarios["maya-previsit"].handoff;
    const invalid = {
      ...handoff,
      agenda: [{ ...handoff.agenda[0], evidenceIds: ["not-in-global-evidence"] }],
    };
    expect(HandoffSchema.safeParse(invalid).success).toBe(false);
  });

  test("keeps every fixture agenda citation within supplied and global evidence", () => {
    for (const fixture of Object.values(scenarios)) {
      expect(HandoffSchema.safeParse(fixture.handoff).success).toBe(true);
      const supplied = new Set(fixture.evidence.map((item) => item.id));
      const global = new Set(fixture.handoff.evidenceIds);
      for (const item of fixture.handoff.agenda) {
        expect(item.evidenceIds.length).toBeGreaterThanOrEqual(1);
        expect(item.evidenceIds.length).toBeLessThanOrEqual(3);
        expect(item.evidenceIds.every((id) => supplied.has(id) && global.has(id))).toBe(true);
      }
    }
  });
});
