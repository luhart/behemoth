import type { AgendaItem, Evidence } from "@/lib/workflow/contracts";

const PATIENT_DERIVED_EVIDENCE_IDS = new Set([
  "derived-native-interpretation",
  "derived-interpretation-ambiguities",
]);

function isPatientAnchor(evidence: Evidence): boolean {
  return evidence.source === "patient"
    || evidence.id.startsWith("patient-")
    || PATIENT_DERIVED_EVIDENCE_IDS.has(evidence.id);
}

/**
 * Chart context can support a patient concern, but it cannot independently add
 * a new concern to a patient-confirmed pre-visit agenda.
 */
export function patientAnchoredAgenda(agenda: AgendaItem[], evidence: Evidence[]): AgendaItem[] {
  const patientEvidenceIds = new Set(evidence.filter(isPatientAnchor).map((item) => item.id));
  return agenda.filter((item) => item.evidenceIds.some((id) => patientEvidenceIds.has(id)));
}
