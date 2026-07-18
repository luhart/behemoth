---
name: athena-chart-context
description: Retrieve the minimum relevant patient context from Athena Preview and attach provenance to every chart-derived claim. Use when an intake, handoff, chart review, or clinical operations workflow needs patient, appointment, problem, medication, allergy, or document facts without treating unavailable data as absent.
---

# Athena chart context

## Retrieve

1. Require Athena Preview, a practice ID, department ID, and an authorized synthetic patient ID.
2. Authenticate server-side with the 2-legged client-credentials flow and `athena/service/Athenanet.MDP.*` scope.
3. Request only resources needed for the stated workflow. Prefer concurrent reads with independent failure capture.
4. Keep partial failures visible as unavailable resources; do not collapse them into empty clinical facts.
5. Normalize proprietary patient IDs separately from FHIR enterprise IDs.

## Provenance

For every fact, retain the Athena resource type, resource identifier when returned, observed or last-modified date, and retrieval environment. Keep patient-reported facts separate.

## Guardrails

- Never expose tokens, upstream response bodies, or patient identifiers in logs.
- Never infer a negative finding from a missing endpoint response.
- Never read or write production from this skill.
- Return raw context plus a provenance ledger; let a downstream skill decide relevance.
