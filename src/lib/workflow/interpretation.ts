import type {
  IntakeInterpretation,
  IntakeInterpretationRequest,
} from "@/lib/workflow/contracts";

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[“”"'’.,!?;:()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SOURCE_LANGUAGE_MARKERS = {
  Tagalog: ["ako", "akong", "ang", "aking", "ay", "hindi", "ko", "may", "mga", "ng", "parang", "sa", "wala"],
  Spanish: ["como", "con", "desde", "dolor", "el", "ella", "en", "estoy", "la", "me", "pero", "por", "que", "siento", "tengo"],
} as const;

/** Rejects outputs that would put source-language text under an English label. */
export function interpretationValidationError(
  request: IntakeInterpretationRequest,
  interpretation: IntakeInterpretation,
): string | null {
  const sourceParts = [request.chiefComplaint, request.clarificationResponse]
    .map(normalize)
    .filter((value) => value.length >= 8);
  const english = normalize(interpretation.englishInterpretation);
  const native = normalize(interpretation.patientInterpretation);

  if (!english || english === native) {
    return "English interpretation is empty or duplicates the native-language rendering.";
  }
  if (sourceParts.some((source) => english === source || english.includes(source))) {
    return "English interpretation reproduces the source-language response verbatim.";
  }

  const englishTokens = new Set(english.split(" "));
  const markerMatches = SOURCE_LANGUAGE_MARKERS[request.preferredLanguage]
    .filter((marker) => englishTokens.has(marker));
  if (markerMatches.length >= 4) {
    return "English interpretation still appears to be in the source language.";
  }
  return null;
}
