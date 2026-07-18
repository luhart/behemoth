import type { SafetyRuleId } from "@/lib/workflow/contracts";

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

export type IntakeSafetyDecision = {
  branch: "standard" | "escalated";
  ruleId?: SafetyRuleId;
  guidance?: string;
};

const EMERGENCY_GUIDANCE =
  "This may be an emergency. Call local emergency services now and do not wait for the appointment.";

const SELF_HARM_GUIDANCE =
  "This needs immediate human support. If there is immediate danger, call local emergency services now; in the U.S., call or text 988.";

const CHEST_SYMPTOMS = [
  // English
  "chest pain",
  "chest pressure",
  "pressure in my chest",
  "pressure in the chest",
  "chest tightness",
  "tightness in my chest",
  "crushing chest pain",
  // Spanish
  "dolor de pecho",
  "dolor en el pecho",
  "presion en el pecho",
  "opresion en el pecho",
  "pecho apretado",
  // Tagalog
  "sakit sa dibdib",
  "masakit ang dibdib",
  "pananakit ng dibdib",
  "paninikip ng dibdib",
  "mabigat ang dibdib",
  "presyon sa dibdib",
] as const;

const BREATHING_SYMPTOMS = [
  // English
  "shortness of breath",
  "short of breath",
  "cannot breathe",
  "cant breathe",
  "difficulty breathing",
  "trouble breathing",
  // Spanish
  "falta de aire",
  "me falta el aire",
  "dificultad para respirar",
  "no puedo respirar",
  "me cuesta respirar",
  // Tagalog
  "hirap huminga",
  "hirap akong huminga",
  "hirap din akong huminga",
  "nahihirapang huminga",
  "nahihirapan akong huminga",
  "hindi makahinga",
  "kinakapos ng hininga",
  "kapos sa hininga",
] as const;

const STROKE_SIGNS = [
  // English
  "facial droop",
  "face drooping",
  "face is drooping",
  "one sided weakness",
  "weakness on one side",
  "numbness on one side",
  "cant move one side",
  "slurred speech",
  "sudden trouble speaking",
  // Spanish
  "cara caida",
  "se me cae la cara",
  "debilidad de un lado",
  "debilidad en un lado",
  "entumecimiento de un lado",
  "no puedo mover un lado",
  "habla arrastrada",
  "dificultad repentina para hablar",
  // Tagalog
  "tabingi ang mukha",
  "laylay ang mukha",
  "panghihina ng isang bahagi",
  "mahina ang isang bahagi",
  "pamamanhid ng isang bahagi",
  "hindi maigalaw ang isang bahagi",
  "bulol magsalita",
  "biglang hirap magsalita",
] as const;

const SEVERE_BLEEDING = [
  // English
  "severe bleeding",
  "bleeding heavily",
  "heavy bleeding",
  "wont stop bleeding",
  "will not stop bleeding",
  "bleeding will not stop",
  "vomiting blood",
  // Spanish
  "sangrado abundante",
  "sangrado intenso",
  "sangrando mucho",
  "no para de sangrar",
  "no deja de sangrar",
  "vomitando sangre",
  // Tagalog
  "malakas ang pagdurugo",
  "matinding pagdurugo",
  "dumudugo nang malakas",
  "hindi tumitigil ang pagdurugo",
  "hindi tumitigil ang dugo",
  "sumusuka ng dugo",
] as const;

const SELF_HARM = [
  // English
  "kill myself",
  "hurt myself",
  "end my life",
  "suicide",
  "suicidal",
  "want to die",
  "dont want to live",
  // Spanish
  "matarme",
  "hacerme dano",
  "quitarme la vida",
  "suicidio",
  "suicida",
  "quiero morir",
  "no quiero vivir",
  // Tagalog
  "magpakamatay",
  "saktan ang sarili",
  "saktan ko ang sarili",
  "wakasan ang buhay",
  "ayoko nang mabuhay",
  "gusto kong mamatay",
] as const;

const NEGATED_PREFIX =
  /(?:^|\s)(?:no|not|never|without|dont|doesnt|didnt|denies|deny|denied|sin|niega|nego|hindi|di|wala|walang)\b(?:\s+\w+){0,5}\s*$/;

const HISTORICAL_CONTEXT =
  /\b(?:history of|previously|used to|last year|years ago|antecedente de|anteriormente|el ano pasado|hace anos|dati|noong nakaraang taon)\b|\bin\s+\d{4}\b|\bnoong\s+\d{4}\b/;

const RESOLVED_CONTEXT = /\b(?:resolved|gone now|not now|ya paso|se resolvio|wala na|nawala na)\b/;

function normalizeSafetyText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[.!?;,\n]+/g, " | ")
    .replace(/[^a-z0-9|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isCurrentMention(text: string, phrase: string, index: number): boolean {
  const clauseStart = text.lastIndexOf("|", index) + 1;
  const nextBoundary = text.indexOf("|", index + phrase.length);
  const clauseEnd = nextBoundary === -1 ? text.length : nextBoundary;
  const prefix = text.slice(clauseStart, index).trim();
  const suffix = text.slice(index + phrase.length, clauseEnd).trim();

  if (NEGATED_PREFIX.test(prefix)) return false;
  if (HISTORICAL_CONTEXT.test(prefix) || HISTORICAL_CONTEXT.test(suffix)) return false;
  if (RESOLVED_CONTEXT.test(suffix)) return false;
  return true;
}

function hasCurrentPhrase(text: string, phrases: readonly string[]): boolean {
  for (const phrase of phrases) {
    let index = text.indexOf(phrase);
    while (index !== -1) {
      const before = index === 0 ? " " : text[index - 1];
      const afterIndex = index + phrase.length;
      const after = afterIndex >= text.length ? " " : text[afterIndex];
      const bounded = !/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after);
      if (bounded && isCurrentMention(text, phrase, index)) return true;
      index = text.indexOf(phrase, index + phrase.length);
    }
  }
  return false;
}

/**
 * A deliberately small, deterministic pre-model safety gate.
 *
 * It only escalates high-specificity phrases. Cardiopulmonary escalation requires
 * both an active chest symptom and active breathing difficulty. Other rules use
 * phrases that are specific enough to stand alone. Negated, historical, and
 * explicitly resolved mentions are ignored where the surrounding text is clear.
 */
export function evaluateIntakeSafety(text: string): IntakeSafetyDecision {
  const normalized = normalizeSafetyText(text);
  if (!normalized) return { branch: "standard" };

  if (hasCurrentPhrase(normalized, SELF_HARM)) {
    return { branch: "escalated", ruleId: "self-harm", guidance: SELF_HARM_GUIDANCE };
  }

  if (hasCurrentPhrase(normalized, STROKE_SIGNS)) {
    return { branch: "escalated", ruleId: "stroke-signs", guidance: EMERGENCY_GUIDANCE };
  }

  if (hasCurrentPhrase(normalized, SEVERE_BLEEDING)) {
    return { branch: "escalated", ruleId: "severe-bleeding", guidance: EMERGENCY_GUIDANCE };
  }

  const hasChestSymptom = hasCurrentPhrase(normalized, CHEST_SYMPTOMS);
  const hasBreathingSymptom = hasCurrentPhrase(normalized, BREATHING_SYMPTOMS);
  if (hasChestSymptom && hasBreathingSymptom) {
    return { branch: "escalated", ruleId: "chest-pain-with-dyspnea", guidance: EMERGENCY_GUIDANCE };
  }

  return { branch: "standard" };
}

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
