import { describe, expect, test } from "bun:test";
import { evaluateWriteIntent } from "../src/lib/workflow/policy";

describe("Athena write policy", () => {
  const valid = {
    approved: true,
    actorRole: "clinician" as const,
    targetEnvironment: "preview" as const,
    writebackEnabled: true,
    noteText: "Patient-approved pre-visit agenda.",
  };

  test("allows an approved Preview write", () => {
    expect(evaluateWriteIntent(valid)).toEqual({ allowed: true });
  });

  test("blocks autonomous agent writes", () => {
    const decision = evaluateWriteIntent({ ...valid, actorRole: "agent" });
    expect(decision.allowed).toBe(false);
  });

  test("blocks production even when approved", () => {
    const decision = evaluateWriteIntent({ ...valid, targetEnvironment: "production" });
    expect(decision.allowed).toBe(false);
  });
});
