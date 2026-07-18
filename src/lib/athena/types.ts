export type AthenaRecord = Record<string, unknown>;

export type AthenaChartContext = {
  patient: AthenaRecord | null;
  appointments: AthenaRecord[];
  problems: AthenaRecord[];
  medications: AthenaRecord[];
  allergies: AthenaRecord[];
  partialFailures: string[];
};

export type AthenaConnectionStatus = {
  configured: boolean;
  connected: boolean;
  mode: "mock" | "live";
  environment: "preview";
  practiceId: string;
  practiceName?: string;
  writebackEnabled: boolean;
  detail: string;
};
