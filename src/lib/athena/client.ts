import "server-only";

import { ATHENA_REST_SCOPE, getAthenaConfig, hasAthenaCredentials, type AthenaConfig } from "@/lib/athena/config";
import type { AthenaChartContext, AthenaConnectionStatus, AthenaRecord } from "@/lib/athena/types";

type TokenCache = { accessToken: string; expiresAt: number } | null;
let tokenCache: TokenCache = null;

function asRecord(value: unknown): AthenaRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as AthenaRecord)
    : null;
}

function flattenRecords(value: unknown): AthenaRecord[] {
  if (Array.isArray(value)) return value.flatMap(flattenRecords);
  const record = asRecord(value);
  return record ? [record] : [];
}

function unwrapList(payload: unknown, keys: string[]): AthenaRecord[] {
  if (Array.isArray(payload)) return flattenRecords(payload);
  const record = asRecord(payload);
  if (!record) return [];
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return flattenRecords(value);
  }
  return [];
}

export class AthenaPreviewClient {
  constructor(private readonly config: AthenaConfig = getAthenaConfig()) {}

  private async accessToken(): Promise<string> {
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error("Athena Preview credentials are not configured.");
    }
    if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.accessToken;

    const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64");
    const body = new URLSearchParams({ grant_type: "client_credentials", scope: ATHENA_REST_SCOPE });
    const response = await fetch(`${this.config.baseUrl}/oauth2/v1/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`Athena token request failed with status ${response.status}.`);
    const payload = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!payload.access_token) throw new Error("Athena token response did not include an access token.");
    tokenCache = {
      accessToken: payload.access_token,
      expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
    };
    return payload.access_token;
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const token = await this.accessToken();
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...init.headers,
      },
      cache: "no-store",
    });
    if (!response.ok) {
      const requestId = response.headers.get("x-request-id");
      throw new Error(
        `Athena request failed with status ${response.status}${requestId ? ` (request ${requestId})` : ""}.`,
      );
    }
    return response.json();
  }

  async connectionStatus(): Promise<AthenaConnectionStatus> {
    const configured = hasAthenaCredentials(this.config);
    if (this.config.mode !== "live" || !configured) {
      return {
        configured,
        connected: false,
        mode: this.config.mode,
        environment: "preview",
        practiceId: this.config.practiceId,
        writebackEnabled: this.config.writebackEnabled,
        detail: configured ? "Live reads are disabled; using deterministic fixtures." : "Add Preview credentials to enable live reads.",
      };
    }

    try {
      const payload = await this.request(`/v1/${this.config.practiceId}/practiceinfo`);
      const practice = unwrapList(payload, ["practiceinfo"])[0];
      return {
        configured: true,
        connected: true,
        mode: "live",
        environment: "preview",
        practiceId: this.config.practiceId,
        practiceName: typeof practice?.name === "string" ? practice.name : undefined,
        writebackEnabled: this.config.writebackEnabled,
        detail: "Authenticated with Athena Preview using a server-side 2-legged token.",
      };
    } catch (error) {
      return {
        configured: true,
        connected: false,
        mode: "live",
        environment: "preview",
        practiceId: this.config.practiceId,
        writebackEnabled: this.config.writebackEnabled,
        detail: error instanceof Error ? error.message : "Athena Preview connection failed.",
      };
    }
  }

  async chartContext(patientId: string): Promise<AthenaChartContext> {
    const practice = this.config.practiceId;
    const department = this.config.departmentId;
    const calls = {
      patient: this.request(`/v1/${practice}/patients/${patientId}`),
      appointments: this.request(`/v1/${practice}/patients/${patientId}/appointments`),
      problems: this.request(`/v1/${practice}/chart/${patientId}/problems?departmentid=${department}`),
      medications: this.request(`/v1/${practice}/chart/${patientId}/medications?departmentid=${department}&medicationtype=ACTIVE`),
      allergies: this.request(`/v1/${practice}/chart/${patientId}/allergies?departmentid=${department}`),
    };
    const entries = await Promise.allSettled(Object.entries(calls).map(async ([key, promise]) => [key, await promise] as const));
    const values = new Map<string, unknown>();
    const partialFailures: string[] = [];
    entries.forEach((entry) => {
      if (entry.status === "fulfilled") values.set(entry.value[0], entry.value[1]);
      else partialFailures.push(entry.reason instanceof Error ? entry.reason.message : "Athena resource unavailable.");
    });

    return {
      patient: unwrapList(values.get("patient"), ["patients", "patient"])[0] ?? asRecord(values.get("patient")),
      appointments: unwrapList(values.get("appointments"), ["appointments"]),
      problems: unwrapList(values.get("problems"), ["problems"]),
      medications: unwrapList(values.get("medications"), ["medications"]),
      allergies: unwrapList(values.get("allergies"), ["allergies"]),
      partialFailures,
    };
  }

  async patientAppointment(patientId: string, appointmentId: string): Promise<AthenaRecord | null> {
    const payload = await this.request(
      `/v1/${this.config.practiceId}/patients/${encodeURIComponent(patientId)}/appointments/${encodeURIComponent(appointmentId)}`,
    );
    return unwrapList(payload, ["appointments", "appointment"])[0] ?? asRecord(payload);
  }

  async createAppointmentNote(appointmentId: string, noteText: string): Promise<unknown> {
    const body = new URLSearchParams({ notetext: noteText, displayonschedule: "false" });
    return this.request(`/v1/${this.config.practiceId}/appointments/${appointmentId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  }
}
