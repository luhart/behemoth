export type WriteIntent = {
  approved: boolean;
  actorRole: "clinician" | "nurse" | "agent";
  targetEnvironment: "preview" | "production";
  writebackEnabled: boolean;
  noteText: string;
};

export type WriteDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

export function evaluateWriteIntent(intent: WriteIntent): WriteDecision {
  if (intent.targetEnvironment !== "preview") {
    return { allowed: false, reason: "Behemoth only writes to Athena Preview." };
  }
  if (!intent.approved) {
    return { allowed: false, reason: "Explicit human approval is required." };
  }
  if (intent.actorRole === "agent") {
    return { allowed: false, reason: "An agent cannot approve its own write." };
  }
  if (!intent.noteText.trim()) {
    return { allowed: false, reason: "The approved note is empty." };
  }
  if (!intent.writebackEnabled) {
    return { allowed: false, reason: "Live writeback is disabled by configuration." };
  }
  return { allowed: true };
}
