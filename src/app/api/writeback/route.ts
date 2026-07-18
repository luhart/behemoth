import { NextResponse } from "next/server";
import { z } from "zod";

import { AthenaPreviewClient } from "@/lib/athena/client";
import { getAthenaConfig } from "@/lib/athena/config";
import { evaluateWriteIntent } from "@/lib/workflow/policy";

const RequestSchema = z.object({
  runId: z.string().min(1),
  approved: z.literal(true),
  actorRole: z.enum(["clinician", "nurse"]),
  appointmentId: z.string().optional(),
  noteText: z.string().min(1).max(4000),
});

export async function POST(request: Request) {
  const parsed = RequestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "A valid human approval is required." }, { status: 400 });

  const config = getAthenaConfig();
  const gate = evaluateWriteIntent({
    approved: parsed.data.approved,
    actorRole: parsed.data.actorRole,
    targetEnvironment: "preview",
    writebackEnabled: true,
    noteText: parsed.data.noteText,
  });
  if (!gate.allowed) return NextResponse.json({ error: gate.reason }, { status: 403 });

  const appointmentId = parsed.data.appointmentId ?? config.demoAppointmentId;
  if (config.mode !== "live" || !config.writebackEnabled) {
    return NextResponse.json({
      success: true,
      mode: "preview-dry-run",
      receipt: `dry_${crypto.randomUUID().slice(0, 8)}`,
      detail: "Approval recorded and payload validated. Live Preview writeback is disabled.",
    });
  }
  if (!appointmentId) {
    return NextResponse.json({ error: "Set ATHENA_DEMO_APPOINTMENT_ID before enabling writeback." }, { status: 409 });
  }

  await new AthenaPreviewClient(config).createAppointmentNote(appointmentId, parsed.data.noteText);
  return NextResponse.json({
    success: true,
    mode: "athena-preview",
    receipt: `athena_${parsed.data.runId}`,
    detail: `Created an appointment note on Preview appointment ${appointmentId}.`,
  });
}
