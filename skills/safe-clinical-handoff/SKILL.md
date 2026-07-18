---
name: safe-clinical-handoff
description: Turn patient concerns and cited chart context into a concise, uncertainty-aware clinician preread. Use when a care team needs a prioritized visit agenda, relevant history, discrepancies, open questions, and disposition while keeping clinical authority with a qualified human.
---

# Safe clinical handoff

## Build the preread

1. Lead with the issue that most changes the visit or requires immediate routing.
2. Summarize patient concerns without converting symptoms into diagnoses.
3. Include only chart history relevant to the current agenda.
4. Put patient/chart conflicts in a dedicated discrepancies section.
5. List unanswered questions instead of guessing.
6. Cite every clinical statement with one or more supplied evidence IDs.
7. Keep the result readable in one minute.

## Output contract

Return: headline, summary, agenda, relevant history, discrepancies, open questions, disposition, confidence, and evidence IDs.

Disposition must be one of `clinician-review`, `nurse-triage`, or `emergency-guidance`. The handoff is always a draft until a qualified human approves it.
