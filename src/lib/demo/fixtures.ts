import type { ClinicalHandoff, Concern, Evidence } from "@/lib/workflow/contracts";

export type ConversationMessage = {
  speaker: "cely" | "patient";
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
      id: "946985",
      displayName: "Maya Santos",
      initials: "MS",
      age: 58,
      language: "Tagalog",
      appointment: "07/20/2026 · 08:00 · Any 15",
    },
    conversation: [
      {
        speaker: "cely",
        text: "Kumusta Maya. Bago ang iyong pagbisita, ano ang pinakamahalagang gusto mong talakayin sa iyong doktor?",
        translated: "Before your visit, what is the most important thing you want to discuss with your doctor?",
      },
      {
        speaker: "patient",
        text: "Kumikirot ang kanang balikat ko halos isang buwan na. Nahihilo rin ako tuwing umaga, kaya tumigil ako sa gamot sa presyon dalawang linggo na ang nakalipas.",
        translated: "My right shoulder has been hurting for nearly a month. I also feel dizzy in the mornings, so I stopped my blood-pressure medicine about two weeks ago.",
      },
      {
        speaker: "cely",
        text: "Kapag sinabi mong “kumikirot,” alin ang pinakamalapit: paulit-ulit na pananakit, mahapdi o nasusunog, o ibang pakiramdam?",
        translated: "When you say “kumikirot,” which is closest: an intermittent ache, stinging or burning, or a different feeling?",
      },
      {
        speaker: "patient",
        text: "Paulit-ulit na pananakit, lalo na kapag itinataas ko ang braso.",
        translated: "An intermittent ache, especially when I raise my arm.",
      },
    ],
    concerns: [
      {
        id: "concern-shoulder",
        patientWords: "Kumikirot ang kanang balikat ko",
        translated: "Intermittent right shoulder ache, worse when raising the arm",
        duration: "Nearly 1 month",
        severity: null,
        priority: "soon",
      },
      {
        id: "concern-dizziness",
        patientWords: "Nahihilo rin ako tuwing umaga",
        translated: "Morning dizziness; stopped blood-pressure medication because of it",
        duration: "About 2 weeks",
        severity: null,
        priority: "soon",
      },
    ],
    evidence: [
      {
        id: "patient-med-stop",
        label: "Patient report",
        value: "Stopped blood-pressure medication about 2 weeks ago because of morning dizziness",
        source: "patient",
        observedAt: "Today",
      },
      {
        id: "athena-med-lisinopril",
        label: "Active medication",
        value: "Lisinopril 10 mg tablet",
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
        id: "patient-shoulder-quality",
        label: "Patient clarification",
        value: "Intermittent ache, worse when raising the arm—not burning or stinging",
        source: "patient",
        observedAt: "Pre-visit intake",
      },
    ],
    handoff: {
      headline: "Confirmed Tagalog intake with medication discrepancy",
      summary:
        "Maya confirmed intermittent right shoulder aching for nearly one month, worse with arm elevation. She also reports morning dizziness and stopping her blood-pressure medication about two weeks ago; lisinopril remains active in Athena.",
      agenda: [
        {
          label: "Reconcile blood-pressure medication use and characterize morning dizziness",
          rationale: "The patient reports stopping blood-pressure medication because of dizziness while Athena lists lisinopril as active.",
          evidenceIds: ["patient-med-stop", "athena-med-lisinopril", "athena-problem-htn"],
        },
        {
          label: "Assess intermittent right shoulder aching and functional impact",
          rationale: "The patient clarified that the pain is an intermittent ache that worsens when she raises her arm.",
          evidenceIds: ["patient-shoulder-quality"],
        },
      ],
      relevantHistory: ["Essential hypertension is active in Athena", "Lisinopril 10 mg remains listed as active"],
      discrepancies: ["Patient says she stopped lisinopril ~2 weeks ago; Athena lists it as active"],
      openQuestions: ["Confirm 0–10 severity and any weakness or limited range of motion", "Any orthostatic measurements or home blood-pressure readings?"],
      disposition: "clinician-review",
      confidence: "high",
      evidenceIds: ["patient-med-stop", "athena-med-lisinopril", "athena-problem-htn", "patient-shoulder-quality"],
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
        speaker: "cely",
        text: "Hola Luis. ¿Qué le gustaría asegurarse de hablar durante su visita?",
        translated: "What would you like to make sure you discuss during your visit?",
      },
      {
        speaker: "patient",
        text: "Siento presión en el pecho y me falta el aire desde esta mañana.",
        translated: "I have chest pressure and shortness of breath since this morning.",
      },
      {
        speaker: "cely",
        text: "Esto podría ser urgente. No espere a la cita. Llame a emergencias ahora; un profesional clínico debe dar seguimiento de inmediato.",
        translated: "This may be urgent. Do not wait for the appointment. Call emergency services now; a qualified clinician should follow up immediately.",
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
        "Intake stopped after Luis reported current chest pressure with shortness of breath. Emergency guidance was shown; the report requires immediate review by a qualified clinical team member.",
      agenda: [
        {
          label: "Review the red-flag report immediately",
          rationale: "Current chest pressure with shortness of breath matched the deterministic emergency branch.",
          evidenceIds: ["patient-chest-pressure", "derived-red-flag"],
        },
        {
          label: "Confirm whether emergency services were contacted",
          rationale: "Emergency guidance was displayed, but patient follow-through remains unknown.",
          evidenceIds: ["derived-red-flag"],
        },
      ],
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
