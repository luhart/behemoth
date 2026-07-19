import {
  type Concern,
  type DxSuggestion,
  type DxSuggestions,
  type Evidence,
} from "@/lib/workflow/contracts";

export const DX_DISCLAIMER =
  "Suggestions for clinician consideration only — not a diagnosis. Confirm against the encounter and code per your organization's coding policy.";

type SymptomRule = {
  pattern: RegExp;
  label: string;
  icd10: string;
  codeLabel: string;
  relatedSymptoms: string[];
};

// Bounded symptom-code map (ICD-10-CM R/H chapters): codes describe what the patient reported, never a disease inference.
const SYMPTOM_RULES: SymptomRule[] = [
  {
    pattern: /headache|head pain|pounding.{0,20}head|masakit ang ulo|sumasakit ang ulo|dolor de cabeza/i,
    label: "Headache",
    icd10: "R51.9",
    codeLabel: "Headache, unspecified",
    relatedSymptoms: ["Vision changes", "Neck stiffness", "Nausea or vomiting", "New neurologic deficit"],
  },
  {
    pattern: /dizz|giddy|lightheaded|nahihilo|hilo\b|mareo|mareada|mareado/i,
    label: "Dizziness",
    icd10: "R42",
    codeLabel: "Dizziness and giddiness",
    relatedSymptoms: ["Room-spinning vertigo", "Hearing change", "Palpitations", "Unsteady gait"],
  },
  {
    pattern: /fever|febrile|lagnat|fiebre|calentura/i,
    label: "Fever",
    icd10: "R50.9",
    codeLabel: "Fever, unspecified",
    relatedSymptoms: ["Chills or rigors", "Rash", "Localizing pain", "Recent travel or exposure"],
  },
  {
    pattern: /nausea|nasusuka|náusea|nausea[s]?\b|ganas de vomitar/i,
    label: "Nausea",
    icd10: "R11.0",
    codeLabel: "Nausea",
    relatedSymptoms: ["Vomiting", "Abdominal pain", "Oral intake tolerance"],
  },
  {
    pattern: /stomach|abdominal|belly|tiyan|est[oó]mago|barriga|vientre/i,
    label: "Abdominal pain",
    icd10: "R10.9",
    codeLabel: "Unspecified abdominal pain",
    relatedSymptoms: ["Pain location and radiation", "Relation to meals", "Bowel changes", "Urinary symptoms"],
  },
  {
    pattern: /cough|ubo\b|inuubo|tos\b/i,
    label: "Cough",
    icd10: "R05.9",
    codeLabel: "Cough, unspecified",
    relatedSymptoms: ["Sputum or blood", "Shortness of breath", "Fever", "Duration beyond 3 weeks"],
  },
  {
    pattern: /fatigue|tired|exhaust|pagod|napapagod|cansanci|fatiga|agotad/i,
    label: "Fatigue",
    icd10: "R53.83",
    codeLabel: "Other fatigue",
    relatedSymptoms: ["Sleep quality", "Weight change", "Low mood", "Exertional intolerance"],
  },
  {
    pattern: /hearing|cannot hear|can't hear|marinig|pandinig|audici[oó]n|no puedo o[ií]r|sordera/i,
    label: "Hearing change",
    icd10: "H91.90",
    codeLabel: "Unspecified hearing loss, unspecified ear",
    relatedSymptoms: ["Ear pain or discharge", "Tinnitus", "Laterality and onset", "Loud-noise exposure"],
  },
  {
    pattern: /insomnia|hindi makatulog|can't sleep|cannot sleep|no puedo dormir|desvelo/i,
    label: "Insomnia",
    icd10: "G47.00",
    codeLabel: "Insomnia, unspecified",
    relatedSymptoms: ["Sleep schedule", "Snoring or apnea", "Caffeine and screens", "Mood changes"],
  },
];

type HistoryRule = {
  pattern: RegExp;
  label: string;
  icd10: string;
  codeLabel: string;
  relatedSymptoms: string[];
};

// Chart-history codes are only emitted when the Athena problem list itself names the condition.
const HISTORY_RULES: HistoryRule[] = [
  {
    pattern: /hypertens|high blood pressure/i,
    label: "Hypertension (on chart)",
    icd10: "I10",
    codeLabel: "Essential (primary) hypertension",
    relatedSymptoms: ["Home BP readings", "Medication adherence", "Headache pattern"],
  },
  {
    pattern: /type 2 diabetes|diabetes mellitus type 2|t2dm/i,
    label: "Type 2 diabetes (on chart)",
    icd10: "E11.9",
    codeLabel: "Type 2 diabetes mellitus without complications",
    relatedSymptoms: ["Glucose monitoring", "Polyuria or polydipsia", "Foot or vision changes"],
  },
  {
    pattern: /asthma/i,
    label: "Asthma (on chart)",
    icd10: "J45.909",
    codeLabel: "Unspecified asthma, uncomplicated",
    relatedSymptoms: ["Rescue-inhaler use", "Night symptoms", "Triggers"],
  },
  {
    pattern: /hyperlipid|high cholesterol/i,
    label: "Hyperlipidemia (on chart)",
    icd10: "E78.5",
    codeLabel: "Hyperlipidemia, unspecified",
    relatedSymptoms: ["Statin adherence", "Diet changes"],
  },
];

function patientReportCorpus(concerns: Concern[], evidence: Evidence[]): string {
  const concernText = concerns.map((concern) => `${concern.patientWords} ${concern.translated ?? ""}`);
  const patientEvidence = evidence
    .filter((item) => item.source === "patient" || item.id === "patient-confirmed-interpretation")
    .map((item) => item.value);
  return [...concernText, ...patientEvidence].join(" ");
}

function symptomEvidenceIds(evidence: Evidence[]): string[] {
  return ["patient-chief-complaint", "patient-confirmed-interpretation", "patient-clarification"]
    .filter((id) => evidence.some((item) => item.id === id))
    .slice(0, 3);
}

export function deterministicDxSuggestions(input: {
  concerns: Concern[];
  evidence: Evidence[];
}): DxSuggestions {
  const corpus = patientReportCorpus(input.concerns, input.evidence);
  const reportedIds = symptomEvidenceIds(input.evidence);
  const fallbackIds = input.evidence.slice(0, 1).map((item) => item.id);
  const symptomSuggestions: DxSuggestion[] = SYMPTOM_RULES.filter((rule) => rule.pattern.test(corpus)).map((rule) => ({
    label: rule.label,
    icd10: rule.icd10,
    codeLabel: rule.codeLabel,
    basis: "reported-symptom",
    relatedSymptoms: rule.relatedSymptoms,
    rationale: `The patient's own report mentions ${rule.label.toLowerCase()}; the code describes the reported symptom, not a diagnosis.`,
    evidenceIds: reportedIds.length > 0 ? reportedIds : fallbackIds,
  }));
  const problems = input.evidence.filter((item) => item.source === "athena" && item.label === "Problem list");
  const historySuggestions: DxSuggestion[] = HISTORY_RULES.flatMap((rule) => {
    const match = problems.find((problem) => rule.pattern.test(problem.value));
    if (!match) return [];
    return [{
      label: rule.label,
      icd10: rule.icd10,
      codeLabel: rule.codeLabel,
      basis: "chart-history" as const,
      relatedSymptoms: rule.relatedSymptoms,
      rationale: `The Athena problem list already contains “${match.value}”; surfaced for reconciliation with today's report.`,
      evidenceIds: [match.id],
    }];
  });
  return {
    suggestions: [...symptomSuggestions, ...historySuggestions].slice(0, 5),
    method: "deterministic",
    disclaimer: DX_DISCLAIMER,
  };
}

