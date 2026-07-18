---
name: adaptive-patient-intake
description: Collect a patient's pre-visit agenda in their preferred language using bounded, safety-aware clarification. Use for outpatient intake before annual, acute, new-patient, specialist, or re-establishment visits when an agent must preserve the patient's words, identify visit priorities, and stop routine intake on red flags without diagnosing.
---

# Adaptive patient intake

## Intake

1. Confirm the patient's preferred written or spoken language.
2. Ask what they most want addressed during the visit.
3. Preserve each answer verbatim and add a clearly labeled translation when needed.
4. Ask only for duration, severity, trajectory, functional impact, and the minimum safety screen relevant to the concern.
5. Keep the agenda to at most five concerns and ask the patient to rank them.

## Safety

- Do not diagnose, recommend treatment, or imply that intake replaces clinical evaluation.
- Run deterministic red-flag checks before any model-generated follow-up.
- When a red flag matches, stop routine intake, show the configured emergency guidance, and route to a qualified human.
- Treat ambiguity as an open question. Never complete missing facts.

## Output

Return structured concerns with the patient's words, optional translation, duration, severity, priority, unanswered questions, and the safety branch taken.
