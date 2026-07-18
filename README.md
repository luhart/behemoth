# Behemoth

**The clinical workflow compiler.** Behemoth turns a messy patient need into a safe, Athena-grounded action, then turns each clinician-approved resolution into a versioned, testable skill reusable by any agent or care team.

The hackathon wedge is intentionally narrow: a multilingual pre-visit intake for a new or long-absent outpatient. The reusable skill compiler is the technical reveal—not a generic dashboard or medical chatbot.

## Three-minute demo

1. Start with Elena's Spanish intake. Her chart says lisinopril is active; she says she stopped taking it two weeks ago.
2. Run `previsit-intake-v1`. The UI shows the bounded intake, Athena evidence, safety gate, and one-minute clinician handoff.
3. Approve the handoff. Behemoth validates an Athena Preview appointment-note payload; live mutation stays disabled unless explicitly enabled.
4. Compile the approved trace. The app emits `SKILL.md`, agent UI metadata, a permission policy, and a replayable golden trace.
5. Switch to the red-flag fixture. The same workflow takes the emergency branch instead of fabricating a routine handoff.

The deterministic fixtures are the reliable golden path. Athena and Claude can be enabled independently, and failures degrade back to the same governed interface.

## Quick start

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Run the full verification suite:

```bash
pnpm verify
```

## Athena Preview

The adapter uses the same 2-legged server authentication contract as the existing Sematic Athena client:

- Base URL: `https://api.preview.platform.athenahealth.com`
- Token: `POST /oauth2/v1/token`
- Scope: `athena/service/Athenanet.MDP.*`
- Reads: patient, appointments, problems, active medications, and allergies
- Approval-gated write: `POST /v1/{practiceid}/appointments/{appointmentid}/notes`

Set these values in `.env.local`:

```bash
ATHENA_MODE=live
NEXT_PUBLIC_ATHENA_CLIENT_ID_2_LEG=...
ATHENA_CLIENT_SECRET_2_LEG=...
ATHENA_PRACTICE_ID=1959870
ATHENA_DEPARTMENT_ID=1
ATHENA_DEMO_PATIENT_ID=1
```

Live reads can remain enabled while writes stay off. To test the real Preview write path, first verify the synthetic appointment manually, then set both:

```bash
ATHENA_DEMO_APPOINTMENT_ID=...
ATHENA_WRITEBACK_ENABLED=true
```

The client refuses live mode against any base URL other than Athena Preview. It never sends credentials to the browser and does not include upstream error bodies in responses.

## Claude

Set `AGENT_MODE=live` and `ANTHROPIC_API_KEY` to ask Claude for the structured handoff. Zod constrains the output; a deterministic safety branch runs before generation, and a fixture handoff is used if the model is unavailable.

## Project map

```text
src/app/                    Next.js UI and route handlers
src/lib/athena/             Preview-only auth and typed client
src/lib/workflow/           schemas, runner, and write policy
src/lib/ai/                 constrained handoff generation
src/lib/skills/             approved-trace skill compiler
src/lib/demo/               synthetic golden-path fixtures
skills/                     portable Codex/Claude-compatible skills
tests/                      policy and compiler contract tests
```

## Safety contract

- Synthetic or explicitly authorized Preview data only.
- Patient words and chart facts remain distinct and cited.
- Missing chart data is “unavailable,” never assumed negative.
- Deterministic red-flag checks can halt the normal workflow.
- The model cannot diagnose, prescribe, approve itself, or write autonomously.
- Every write requires a human role, explicit approval, Preview environment, and a separate configuration flag.

## What is new

All Behemoth application, workflow, policy, compiler, fixture, and skill code in this repository was created for the hackathon. The Athena authentication and endpoint contract were researched from the team's existing Sematic client and local Athena OpenAPI notes; that existing application code is not copied into this repository.

## Portable skills

- `adaptive-patient-intake` — preferred-language agenda capture and bounded clarification
- `athena-chart-context` — minimum necessary chart retrieval with provenance
- `safe-clinical-handoff` — concise preread with uncertainty and discrepancies
- `athena-approved-action` — explicit approval, Preview write, and verification
- `compile-workflow-skill` — approved trace to governed skill package

Future expansion: compile a care-gap outreach workflow for APCM/VBC, using the same runtime and policy gates.
