import { NextResponse } from "next/server";
import { z } from "zod";

import { compileRunToSkill } from "@/lib/skills/compiler";
import { RunResultSchema } from "@/lib/workflow/contracts";

const RequestSchema = z.object({
  run: RunResultSchema,
  corrections: z.array(z.string().min(1).max(300)).max(10).default([]),
});

export async function POST(request: Request) {
  const parsed = RequestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid approved run" }, { status: 400 });
  if (parsed.data.run.approval.status !== "approved") {
    return NextResponse.json({ error: "Only an approved run can be compiled." }, { status: 403 });
  }
  return NextResponse.json(compileRunToSkill(parsed.data.run, parsed.data.corrections));
}
