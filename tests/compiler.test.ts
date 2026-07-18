import { describe, expect, test } from "bun:test";
import { getScenario } from "../src/lib/demo/fixtures";
import { compileRunToSkill } from "../src/lib/skills/compiler";
import type { RunResult } from "../src/lib/workflow/contracts";

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
  });
});
