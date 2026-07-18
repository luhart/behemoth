import type { Concern, RunResult } from "@/lib/workflow/contracts";

export type GlanceComplaint = {
  english: string;
  native: string;
  isTop: boolean;
};

export type GlanceHistory = {
  problems: string[];
  medications: string[];
  allergies: string[];
};

export type ClinicianGlance = {
  patientLine: string;
  topConcern: GlanceComplaint | null;
  complaints: GlanceComplaint[];
  history: GlanceHistory;
  reconcile: string[];
  askFirst: string[];
  estimatedReadSeconds: number;
};

function orderedConcerns(concerns: Concern[]): Concern[] {
  return [...concerns].sort((left, right) => {
    if (left.patientPriority === "top" && right.patientPriority !== "top") return -1;
    if (right.patientPriority === "top" && left.patientPriority !== "top") return 1;
    return (left.mentionOrder ?? 99) - (right.mentionOrder ?? 99);
  });
}

function ambiguityReconciliations(run: RunResult): string[] {
  const ambiguityEvidence = run.evidence.find((item) => item.id === "derived-interpretation-ambiguities");
  if (!ambiguityEvidence) return [];
  return ambiguityEvidence.value
    .split(";")
    .map((ambiguity) => ambiguity.trim())
    .filter(Boolean)
    .map((ambiguity) => `Interpretation ambiguity: ${ambiguity}`);
}

// Reading-time heuristic: ~200 wpm scan pace, bounded to the promised 1–3 minute window.
function estimatedReadSeconds(parts: string[]): number {
  const words = parts.join(" ").split(/\s+/).filter(Boolean).length;
  return Math.min(180, Math.max(60, Math.round((words / 200) * 60) + 45));
}

export function buildClinicianGlance(run: RunResult): ClinicianGlance {
  const concerns = orderedConcerns(run.concerns);
  const complaints = concerns.map((concern) => ({
    english: concern.translated ?? concern.patientWords,
    native: concern.patientWords,
    isTop: concern.patientPriority === "top",
  }));
  const athenaFacts = run.evidence.filter((item) => item.source === "athena");
  const history: GlanceHistory = {
    problems: athenaFacts.filter((item) => item.label === "Problem list").map((item) => item.value),
    medications: athenaFacts.filter((item) => item.label === "Active medication").map((item) => item.value),
    allergies: athenaFacts.filter((item) => item.label === "Allergy").map((item) => item.value),
  };
  const reconcile = [...run.handoff.discrepancies, ...ambiguityReconciliations(run)].slice(0, 4);
  const askFirst = run.handoff.openQuestions.slice(0, 2);
  return {
    patientLine: `${run.patient.displayName} · ${run.patient.age} · ${run.patient.language} preferred · ${run.patient.appointment}`,
    topConcern: complaints.find((complaint) => complaint.isTop) ?? null,
    complaints,
    history,
    reconcile,
    askFirst,
    estimatedReadSeconds: estimatedReadSeconds([
      run.handoff.summary,
      ...complaints.map((complaint) => complaint.english),
      ...history.problems,
      ...history.medications,
      ...history.allergies,
      ...reconcile,
      ...askFirst,
    ]),
  };
}
