import type { ClinicalHandoff, Concern, Evidence } from "@/lib/workflow/contracts";

export type ConversationMessage = {
  speaker: "behemoth" | "patient";
  text: string;
  translated?: string;
};

export type DemoScenario = {
  id: "maya-previsit" | "luis-escalation";
  patient: {
    id: string;
    displayName: string;
    initials: string;
    age: number;
    language: string;
    appointment: string;
  };
  conversation: ConversationMessage[];
  concerns: Concern[];
  evidence: Evidence[];
  handoff: ClinicalHandoff;
};

export const scenarios: Record<DemoScenario["id"], DemoScenario> = {
  "maya-previsit": {
    id: "maya-previsit",
    patient: {
      id: "1",
      displayName: "Elena Marquez",
      initials: "EM",
      age: 58,
      language: "Spanish",
      appointment: "Today · 2:30 PM · Annual visit",
    },
    conversation: [
      {
        speaker: "behemoth",
        text: "Hola Elena. Antes de su visita, ¿qué es lo más importante que quiere hablar con la Dra. Shah?",
        translated: "Before your visit, what is most important to discuss with Dr. Shah?",
      },
      {
        speaker: "patient",
        text: "Me mareo por las mañanas y dejé de tomar la pastilla para la presión hace como dos semanas.",
        translated: "I feel dizzy in the mornings and stopped my blood-pressure pill about two weeks ago.",
      },
      {
        speaker: "behemoth",
        text: "¿Se ha desmayado, tiene dolor de pecho, falta de aire o debilidad en un lado del cuerpo?",
        translated: "Any fainting, chest pain, shortness of breath, or one-sided weakness?",
      },
      {
        speaker: "patient",
        text: "No. Ayer mi presión fue 146 sobre 88. También me duele el hombro derecho desde hace un mes.",
        translated: "No. Yesterday my blood pressure was 146/88. My right shoulder has also hurt for a month.",
      },
    ],
    concerns: [
      {
        id: "concern-dizziness",
        patientWords: "Me mareo por las mañanas",
        translated: "Morning dizziness",
        duration: "About 2 weeks",
        severity: 4,
        priority: "soon",
      },
      {
        id: "concern-shoulder",
        patientWords: "Me duele el hombro derecho",
        translated: "Right shoulder pain",
        duration: "1 month",
        severity: 5,
        priority: "routine",
      },
    ],
    evidence: [
      {
        id: "patient-med-stop",
        label: "Patient report",
        value: "Stopped blood-pressure medication ~2 weeks ago",
        source: "patient",
        observedAt: "Today",
      },
      {
        id: "athena-med-lisinopril",
        label: "Active medication",
        value: "Lisinopril 10 mg daily",
        source: "athena",
        resource: "Medication / Athena Preview",
        observedAt: "Updated May 12",
      },
      {
        id: "athena-problem-htn",
        label: "Problem list",
        value: "Essential hypertension",
        source: "athena",
        resource: "Problem / Athena Preview",
        observedAt: "Active",
      },
      {
        id: "patient-bp",
        label: "Home reading",
        value: "146/88 yesterday",
        source: "patient",
        observedAt: "Yesterday",
      },
    ],
    handoff: {
      headline: "Medication discrepancy before annual visit",
      summary:
        "Elena reports two weeks of morning dizziness and independently stopping lisinopril, which remains active in Athena. No red-flag symptoms reported. She also wants to address one month of right shoulder pain.",
      agenda: [
        "Reconcile lisinopril use and characterize morning dizziness",
        "Review home blood-pressure trend; patient recalls 146/88 yesterday",
        "Assess right shoulder pain and functional impact",
      ],
      relevantHistory: ["Essential hypertension is active in Athena", "Lisinopril 10 mg remains listed as active"],
      discrepancies: ["Patient says she stopped lisinopril ~2 weeks ago; Athena lists it as active"],
      openQuestions: ["What prompted the medication stop?", "Any orthostatic measurements or additional home readings?"],
      disposition: "clinician-review",
      confidence: "high",
      evidenceIds: ["patient-med-stop", "athena-med-lisinopril", "athena-problem-htn", "patient-bp"],
    },
  },
  "luis-escalation": {
    id: "luis-escalation",
    patient: {
      id: "3520",
      displayName: "Luis Rivera",
      initials: "LR",
      age: 64,
      language: "Spanish",
      appointment: "Tomorrow · 9:00 AM · New patient",
    },
    conversation: [
      {
        speaker: "behemoth",
        text: "Hola Luis. ¿Qué le gustaría asegurarse de hablar durante su visita?",
        translated: "What would you like to make sure you discuss during your visit?",
      },
      {
        speaker: "patient",
        text: "Siento presión en el pecho y me falta el aire desde esta mañana.",
        translated: "I have chest pressure and shortness of breath since this morning.",
      },
      {
        speaker: "behemoth",
        text: "Esto podría ser urgente. No espere a la cita. Llame a emergencias ahora; también estoy alertando al equipo clínico.",
        translated: "This may be urgent. Do not wait for the appointment. Call emergency services now; I am also alerting the clinical team.",
      },
    ],
    concerns: [
      {
        id: "concern-chest-pressure",
        patientWords: "Presión en el pecho y me falta el aire",
        translated: "Chest pressure with shortness of breath",
        duration: "Since this morning",
        severity: 8,
        priority: "urgent",
      },
    ],
    evidence: [
      {
        id: "patient-chest-pressure",
        label: "Red-flag report",
        value: "Current chest pressure with shortness of breath",
        source: "patient",
        observedAt: "Now",
      },
      {
        id: "derived-red-flag",
        label: "Safety policy",
        value: "Immediate escalation branch matched",
        source: "derived",
        resource: "previsit-intake-v1 / red-flag gate",
      },
    ],
    handoff: {
      headline: "Immediate escalation: chest pressure + dyspnea",
      summary:
        "Intake stopped after Luis reported current chest pressure with shortness of breath. Emergency guidance was shown and the case is routed for immediate nurse follow-up.",
      agenda: ["Confirm emergency services were contacted", "Alert the on-call clinical team"],
      relevantHistory: [],
      discrepancies: [],
      openQuestions: ["Has the patient reached emergency services?"],
      disposition: "emergency-guidance",
      confidence: "high",
      evidenceIds: ["patient-chest-pressure", "derived-red-flag"],
    },
  },
};

export function getScenario(id: DemoScenario["id"]): DemoScenario {
  return scenarios[id];
}
