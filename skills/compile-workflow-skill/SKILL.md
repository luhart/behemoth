---
name: compile-workflow-skill
description: Convert an approved clinical workflow trace and human corrections into a draft, portable, governed agent skill. Use after a qualified clinician validates a completed workflow and the team wants reusable instructions, permissions, structured contracts, and a golden-trace test for Codex, Claude Code, or another skill-compatible runtime.
---

# Compile workflow skill

## Compile

1. Accept only a completed trace with explicit qualified-human approval.
2. Separate repeatable workflow behavior from patient-specific facts.
3. Convert clinician corrections into general instructions only when the trace supports them.
4. Emit a hyphen-case skill name under 64 characters.
5. Create `SKILL.md` with only `name` and `description` in frontmatter.
6. Emit `agents/openai.yaml`, a least-privilege policy, and a de-identified golden trace.

## Govern

- Preserve every safety stop, approval gate, uncertainty route, and environment restriction from the source workflow.
- Never embed patient names, identifiers, free-text notes, credentials, or tokens.
- Default write permissions to none; add only actions present in the approved trace.
- Mark the result as draft until independent review and replay pass.

## Validate

Run structural validation, then replay the golden trace and at least one different branch. Reject a skill that only reproduces the source patient or weakens a human gate.
