export const ATHENA_PREVIEW_BASE_URL = "https://api.preview.platform.athenahealth.com";
export const ATHENA_REST_SCOPE = "athena/service/Athenanet.MDP.*";

export type AthenaConfig = {
  mode: "mock" | "live";
  baseUrl: string;
  clientId?: string;
  clientSecret?: string;
  practiceId: string;
  departmentId: string;
  demoPatientId: string;
  demoAppointmentId?: string;
  writebackEnabled: boolean;
};

export function getAthenaConfig(): AthenaConfig {
  const baseUrl = (process.env.ATHENA_BASE_URL ?? ATHENA_PREVIEW_BASE_URL).replace(/\/$/, "");
  const mode = process.env.ATHENA_MODE === "live" ? "live" : "mock";

  if (mode === "live" && baseUrl !== ATHENA_PREVIEW_BASE_URL) {
    throw new Error("Cely refuses Athena live mode outside the Preview base URL.");
  }

  return {
    mode,
    baseUrl,
    clientId: process.env.NEXT_PUBLIC_ATHENA_CLIENT_ID_2_LEG,
    clientSecret: process.env.ATHENA_CLIENT_SECRET_2_LEG,
    practiceId: process.env.ATHENA_PRACTICE_ID ?? "1959870",
    departmentId: process.env.ATHENA_DEPARTMENT_ID ?? "1",
    demoPatientId: process.env.ATHENA_DEMO_PATIENT_ID ?? "1",
    demoAppointmentId: process.env.ATHENA_DEMO_APPOINTMENT_ID,
    writebackEnabled: process.env.ATHENA_WRITEBACK_ENABLED === "true",
  };
}

export function hasAthenaCredentials(config = getAthenaConfig()): boolean {
  return Boolean(config.clientId && config.clientSecret);
}
