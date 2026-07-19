import type { RunResult } from "@/lib/workflow/contracts";

const compact = (value: string) => value.replace(/\s+/g, " ").trim();

function truncate(value: string, maximum: number): string {
  const normalized = compact(value);
  if (normalized.length <= maximum) return normalized;
  return `${normalized.slice(0, maximum - 1).trimEnd()}…`;
}

export function createAthenaAppointmentNote(result: RunResult): string {
  const patientPriorities = [...result.concerns].sort((left, right) => {
    if (left.patientPriority === "top" && right.patientPriority !== "top") return -1;
    if (right.patientPriority === "top" && left.patientPriority !== "top") return 1;
    return (left.mentionOrder ?? 99) - (right.mentionOrder ?? 99);
  });
  const topPriority = patientPriorities.find((concern) => concern.patientPriority === "top");
  const concernText = patientPriorities
    .map((concern, index) => `${index + 1}) ${truncate(concern.translated ?? concern.patientWords, 150)}`)
    .join("; ");
  const agendaText = result.handoff.agenda
    .map((item, index) => `${index + 1}) ${truncate(item.label, 130)}`)
    .join("; ");
  const discrepancyText = result.handoff.discrepancies
    .slice(0, 3)
    .map((item) => truncate(item, 180))
    .join("; ");

  return [
    "Cely pre-visit intake (clinician approved)",
    topPriority ? `Patient priority: ${truncate(topPriority.translated ?? topPriority.patientWords, 180)}` : null,
    `Confirmed concerns: ${concernText}`,
    `Visit agenda: ${agendaText}`,
    discrepancyText ? `Reconcile: ${discrepancyText}` : null,
    `Run: ${result.runId}`,
  ].filter((section): section is string => Boolean(section)).join(" | ");
}
