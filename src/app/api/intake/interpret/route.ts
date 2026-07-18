import { NextResponse } from "next/server";

import { interpretIntake } from "@/lib/ai/interpret-intake";
import { IntakeInterpretationRequestSchema } from "@/lib/workflow/contracts";
import { evaluateIntakeSafety } from "@/lib/workflow/policy";

export const maxDuration = 30;

export async function POST(request: Request) {
  const parsed = IntakeInterpretationRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid interpretation request", issues: parsed.error.flatten() }, { status: 400 });
  }

  const safety = evaluateIntakeSafety(`${parsed.data.chiefComplaint} ${parsed.data.clarificationResponse}`);
  if (safety.branch === "escalated") {
    return NextResponse.json(
      { error: "Routine interpretation stopped by the deterministic safety policy.", safety },
      { status: 409 },
    );
  }

  try {
    const result = await interpretIntake(parsed.data);
    return NextResponse.json({ ...result, mode: "sonnet" });
  } catch {
    return NextResponse.json(
      { error: "English interpretation is temporarily unavailable. Please retry or use a qualified interpreter." },
      { status: 503 },
    );
  }
}
