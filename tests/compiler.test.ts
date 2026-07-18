import { describe, expect, test } from "bun:test";
import { getScenario, scenarios } from "../src/lib/demo/fixtures";
import { compileRunToSkill } from "../src/lib/skills/compiler";
import { HandoffSchema, type RunResult } from "../src/lib/workflow/contracts";

const scenario = getScenario("maya-previsit");
const run: RunResult = {
  runId: "run_test",
  workflowId: "previsit-intake-v1",
  scenarioId: scenario.id,
  startedAt: "2026-07-18T12:00:00.000Z",
  completedAt: "2026-07-18T12:00:01.000Z",
  patient: scenario.patient,
  concerns: scenario.concerns,
  evidence: scenario.evidence,
  handoff: scenario.handoff,
  execution: { athena: "fixture", model: "fixture", safetyBranch: "standard" },
  approval: { required: true, status: "pending" },
};

describe("skill compiler", () => {
  test("emits a valid skill package with policy and golden trace", () => {
    const compiled = compileRunToSkill(run, ["Always put medication reconciliation first."]);
    expect(compiled.name).toBe("previsit-clinician-review");
    expect(compiled.files.map((file) => file.path)).toEqual([
      "SKILL.md",
      "agents/openai.yaml",
      "references/policy.json",
      "references/golden-trace.json",
    ]);
    const skill = compiled.files[0]?.content ?? "";
    expect(skill).toContain("approval");
    expect(skill).toContain("medication reconciliation first");
    expect(skill).toContain("one to three evidence IDs");
    const goldenTrace = JSON.parse(compiled.files.find((file) => file.path === "references/golden-trace.json")?.content ?? "{}") as {
      expected?: { agenda?: Array<{ label: string; evidenceIds: string[] }> };
    };
    expect(goldenTrace.expected?.agenda?.[0]?.evidenceIds).toEqual(scenario.handoff.agenda[0]?.evidenceIds);
  });

  test("rejects agenda evidence that is absent from global handoff evidence", () => {
    const invalid = {
      ...scenario.handoff,
      agenda: [{ ...scenario.handoff.agenda[0], evidenceIds: ["not-in-global-evidence"] }],
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
