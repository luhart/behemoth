import { NextResponse } from "next/server";

import { RunInputSchema } from "@/lib/workflow/contracts";
import { runPrevisitWorkflow } from "@/lib/workflow/runner";

export const maxDuration = 45;

export async function POST(request: Request) {
  const parsed = RunInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid workflow input", issues: parsed.error.flatten() }, { status: 400 });
  }
  const result = await runPrevisitWorkflow(parsed.data);
  return NextResponse.json(result);
}
