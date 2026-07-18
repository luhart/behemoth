import { z } from "zod";

export const EvidenceSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
  source: z.enum(["patient", "athena", "derived"]),
  resource: z.string().optional(),
  observedAt: z.string().optional(),
});

export const ConcernSchema = z.object({
  id: z.string(),
  patientWords: z.string(),
  translated: z.string().optional(),
  duration: z.string(),
  severity: z.number().int().min(0).max(10),
  priority: z.enum(["routine", "soon", "urgent"]),
});

export const HandoffSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  agenda: z.array(z.string()).min(1).max(5),
  relevantHistory: z.array(z.string()).max(6),
  discrepancies: z.array(z.string()).max(5),
  openQuestions: z.array(z.string()).max(5),
  disposition: z.enum(["clinician-review", "nurse-triage", "emergency-guidance"]),
  confidence: z.enum(["high", "medium", "low"]),
  evidenceIds: z.array(z.string()),
});

export const RunInputSchema = z.object({
  scenarioId: z.enum(["maya-previsit", "luis-escalation"]).default("maya-previsit"),
  preferLiveAthena: z.boolean().default(false),
  preferLiveModel: z.boolean().default(false),
});

export const RunResultSchema = z.object({
  runId: z.string(),
  workflowId: z.literal("previsit-intake-v1"),
  scenarioId: RunInputSchema.shape.scenarioId,
  startedAt: z.string(),
  completedAt: z.string(),
  patient: z.object({
    id: z.string(),
    displayName: z.string(),
    age: z.number(),
    language: z.string(),
    appointment: z.string(),
  }),
  concerns: z.array(ConcernSchema),
  evidence: z.array(EvidenceSchema),
  handoff: HandoffSchema,
  execution: z.object({
    athena: z.enum(["live", "partial", "fixture", "degraded"]),
    model: z.enum(["live", "fixture", "degraded"]),
    safetyBranch: z.enum(["standard", "escalated"]),
  }),
  approval: z.object({
    required: z.literal(true),
    status: z.enum(["pending", "approved"]),
  }),
});

export type Evidence = z.infer<typeof EvidenceSchema>;
export type Concern = z.infer<typeof ConcernSchema>;
export type ClinicalHandoff = z.infer<typeof HandoffSchema>;
export type RunInput = z.infer<typeof RunInputSchema>;
export type RunResult = z.infer<typeof RunResultSchema>;
