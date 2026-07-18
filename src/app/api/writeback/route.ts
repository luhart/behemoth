import { NextResponse } from "next/server";
import { z } from "zod";

import { AthenaPreviewClient } from "@/lib/athena/client";
import { getAthenaConfig } from "@/lib/athena/config";
import type { AthenaRecord } from "@/lib/athena/types";
import { evaluateWriteIntent } from "@/lib/workflow/policy";

const RequestSchema = z.object({
  runId: z.string().min(1),
  approved: z.literal(true),
  actorRole: z.enum(["clinician", "nurse"]),
  appointmentId: z.string().optional(),
  noteText: z.string().min(1).max(4000),
});

const BOOKED_APPOINTMENT_STATUSES = new Set(["f", "filled", "booked", "scheduled"]);

function stringValue(record: AthenaRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function appointmentDay(date: string): number | undefined {
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(date);
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(date);
  const parts = slash
    ? [Number(slash[3]), Number(slash[1]), Number(slash[2])]
    : iso
      ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
      : undefined;
  if (!parts) return undefined;
  const [year, month, day] = parts;
  const value = new Date(year, month - 1, day);
  if (value.getFullYear() !== year || value.getMonth() !== month - 1 || value.getDate() !== day) return undefined;
  return value.setHours(0, 0, 0, 0);
}

function verifyAppointment(
  appointment: AthenaRecord,
  expectedPatientId: string,
  expectedAppointmentId: string,
): string | undefined {
  const patientId = stringValue(appointment, ["patientid", "patientId"]);
  const appointmentId = stringValue(appointment, ["appointmentid", "appointmentId", "id"]);
  if (patientId !== expectedPatientId || appointmentId !== expectedAppointmentId) {
    return "Athena did not return the configured patient/appointment binding.";
  }

  const status = stringValue(appointment, ["appointmentstatus", "status"])?.toLowerCase();
  if (!status || !BOOKED_APPOINTMENT_STATUSES.has(status)) {
    return "The configured appointment is no longer in a booked status.";
  }

  const date = stringValue(appointment, ["date", "appointmentdate"]);
  const day = date ? appointmentDay(date) : undefined;
  const today = new Date().setHours(0, 0, 0, 0);
  if (day === undefined || day < today) {
    return "The configured appointment is not current or upcoming.";
  }
  return undefined;
}

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

  if (config.mode !== "live" || !config.writebackEnabled) {
    return NextResponse.json({
      success: true,
      mode: "preview-dry-run",
      receipt: `dry_${crypto.randomUUID().slice(0, 8)}`,
      detail: "Approval recorded and payload validated. Live Preview writeback is disabled.",
    });
  }

  const appointmentId = parsed.data.appointmentId?.trim();
  const configuredAppointmentId = config.demoAppointmentId?.trim();
  const configuredPatientId = process.env.ATHENA_DEMO_PATIENT_ID?.trim();
  if (!appointmentId) {
    return NextResponse.json({ error: "The approved run did not include an Athena appointment ID." }, { status: 409 });
  }
  if (!configuredAppointmentId || !configuredPatientId) {
    return NextResponse.json(
      { error: "Set ATHENA_DEMO_PATIENT_ID and ATHENA_DEMO_APPOINTMENT_ID before enabling writeback." },
      { status: 409 },
    );
  }
  if (appointmentId !== configuredAppointmentId) {
    return NextResponse.json({ error: "The approved run is not bound to the configured Preview appointment." }, { status: 403 });
  }

  const client = new AthenaPreviewClient(config);
  let appointment: AthenaRecord | null;
  try {
    appointment = await client.patientAppointment(configuredPatientId, appointmentId);
  } catch {
    return NextResponse.json({ error: "Athena could not verify the configured appointment; no write was attempted." }, { status: 409 });
  }
  if (!appointment) {
    return NextResponse.json({ error: "Athena did not return the configured appointment; no write was attempted." }, { status: 409 });
  }
  const verificationError = verifyAppointment(appointment, configuredPatientId, appointmentId);
  if (verificationError) {
    return NextResponse.json({ error: verificationError }, { status: 409 });
  }

  await client.createAppointmentNote(appointmentId, parsed.data.noteText);
  return NextResponse.json({
    success: true,
    mode: "athena-preview",
    receipt: `athena_${parsed.data.runId}`,
    detail: `Created an appointment note on Preview appointment ${appointmentId}.`,
  });
}
