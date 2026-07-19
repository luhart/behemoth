"use client";

import {
  Activity,
  ArrowRight,
  BookOpenCheck,
  Check,
  CircleAlert,
  ClipboardCheck,
  Cloud,
  Code2,
  FileCheck2,
  GitBranch,
  Languages,
  LockKeyhole,
  Play,
  RotateCcw,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { PatientIntake, type ConfirmedIntake, type UrgentIntake } from "@/components/patient-intake";
import { getScenario, type DemoScenario } from "@/lib/demo/fixtures";
import type { CompiledSkill } from "@/lib/skills/compiler";
import type { RunResult } from "@/lib/workflow/contracts";
import { deriveTraceMetrics } from "@/lib/workflow/metrics";

type Phase = "idle" | "running" | "review" | "approved" | "compiled";
type AthenaStatus = {
  connected: boolean;
  configured: boolean;
  mode: "mock" | "live";
  environment: "preview";
  practiceId: string;
  practiceName?: string;
  writebackEnabled: boolean;
  detail: string;
};

const workflowSteps = [
  { label: "Listen", detail: "first-message language", icon: Languages },
  { label: "Ground", detail: "Athena context", icon: Cloud },
  { label: "Guard", detail: "deterministic safety", icon: ShieldCheck },
  { label: "Handoff", detail: "evidence-linked", icon: ClipboardCheck },
  { label: "Approve", detail: "human authority", icon: UserRoundCheck },
  { label: "Compile", detail: "portable skill", icon: Code2 },
] as const;

const delay = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
const preferredScrollBehavior = (): ScrollBehavior => window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

function createNote(result: RunResult): string {
  const patientPriorities = [...result.concerns].sort((left, right) => {
    if (left.patientPriority === "top" && right.patientPriority !== "top") return -1;
    if (right.patientPriority === "top" && left.patientPriority !== "top") return 1;
    return (left.mentionOrder ?? 99) - (right.mentionOrder ?? 99);
  });
  return [
    "CELY PRE-VISIT INTAKE — CLINICIAN APPROVED",
    "",
    result.handoff.summary,
    "",
    "PATIENT-CONFIRMED PRIORITIES",
    ...patientPriorities.map(
      (concern, index) => `${index + 1}. ${concern.translated ?? concern.patientWords}${concern.patientPriority === "top" ? " [patient's top priority]" : ""}\n   Original: ${concern.patientWords}`,
    ),
    "",
    "VISIT AGENDA",
    ...result.handoff.agenda.map(
      (item) => `- ${item.label}\n  Rationale: ${item.rationale}\n  Evidence: ${item.evidenceIds.join(", ")}`,
    ),
    ...(result.handoff.discrepancies.length
      ? ["", "DISCREPANCIES TO RECONCILE", ...result.handoff.discrepancies.map((item) => `- ${item}`)]
      : []),
    "",
    `Audit: ${result.runId}`,
  ].join("\n");
}

function SourceLabel({ source }: { source: "patient" | "athena" | "derived" }) {
  const Icon = source === "athena" ? Cloud : source === "patient" ? Languages : GitBranch;
  const label = source === "athena" ? "Athena Preview" : source === "patient" ? "Patient report" : "Interpretation";
  return (
    <span className={`source-label source-${source}`}>
      <Icon size={12} aria-hidden="true" />
      {label}
    </span>
  );
}

export function CelyStudio() {
  const [scenarioId, setScenarioId] = useState<DemoScenario["id"]>("maya-previsit");
  const [phase, setPhase] = useState<Phase>("idle");
  const [activeStep, setActiveStep] = useState(-1);
  const [run, setRun] = useState<RunResult | null>(null);
  const [status, setStatus] = useState<AthenaStatus | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [compiled, setCompiled] = useState<CompiledSkill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intakeKey, setIntakeKey] = useState(0);
  const [intakeLanguage, setIntakeLanguage] = useState<string | null>(null);
  const scenario = useMemo(() => getScenario(scenarioId), [scenarioId]);
  const traceMetrics = useMemo(() => run ? deriveTraceMetrics(run) : null, [run]);
  const orderedPatientConcerns = useMemo(() => {
    if (!run) return [];
    return [...run.concerns].sort((left, right) => {
      if (left.patientPriority === "top" && right.patientPriority !== "top") return -1;
      if (right.patientPriority === "top" && left.patientPriority !== "top") return 1;
      return (left.mentionOrder ?? 99) - (right.mentionOrder ?? 99);
    });
  }, [run]);

  useEffect(() => {
    fetch("/api/athena/status", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Connection check failed");
        setStatus((await response.json()) as AthenaStatus);
      })
      .catch(() => {
        setStatus({
          connected: false,
          configured: false,
          mode: "mock",
          environment: "preview",
          practiceId: "1959870",
          writebackEnabled: false,
          detail: "Fixture mode is ready.",
        });
      });
  }, []);

  const selectScenario = (next: DemoScenario["id"]) => {
    if (phase === "running") return;
    setScenarioId(next);
    setPhase("idle");
    setActiveStep(-1);
    setRun(null);
    setReceipt(null);
    setCompiled(null);
    setError(null);
    setIntakeLanguage(null);
    setIntakeKey((current) => current + 1);
  };

  const runWorkflow = async (intake?: ConfirmedIntake, urgentIntake?: UrgentIntake) => {
    setIntakeLanguage(intake?.preferredLanguage ?? urgentIntake?.preferredLanguage ?? null);
    setPhase("running");
    setActiveStep(urgentIntake ? 2 : intake ? 1 : 0);
    setRun(null);
    setReceipt(null);
    setCompiled(null);
    setError(null);

    try {
      const runRequest = fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId,
          preferLiveAthena: Boolean(status?.connected) && scenarioId === "maya-previsit",
          preferLiveModel: true,
          intake,
          urgentIntake,
        }),
      });

      if (!urgentIntake) {
        for (let index = intake ? 2 : 1; index <= 2; index += 1) {
          await delay(480);
          setActiveStep(index);
        }
      }
      const response = await runRequest;
      if (!response.ok) throw new Error("The workflow run could not be completed.");
      const result = (await response.json()) as RunResult;
      if (result.execution.safetyBranch === "standard") {
        for (let index = 3; index <= 4; index += 1) {
          await delay(360);
          setActiveStep(index);
        }
      } else {
        setActiveStep(4);
      }
      setRun(result);
      setPhase("review");
    } catch (caught) {
      setPhase("idle");
      setActiveStep(-1);
      if (intake) setIntakeKey((current) => current + 1);
      setError(caught instanceof Error ? caught.message : "The workflow run failed.");
    }
  };

  const approveRun = async () => {
    if (!run) return;
    setError(null);
    if (run.execution.safetyBranch === "escalated") {
      setRun({ ...run, approval: { required: true, status: "approved" } });
      setReceipt("Escalation acknowledged by clinician. No Athena write was attempted.");
      setActiveStep(4);
      setPhase("approved");
      return;
    }
    try {
      const response = await fetch("/api/writeback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: run.runId,
          approved: true,
          actorRole: "clinician",
          appointmentId: run.patient.appointmentId,
          noteText: createNote(run),
        }),
      });
      const payload = (await response.json()) as { receipt?: string; detail?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Approval could not be recorded.");
      setRun({ ...run, approval: { required: true, status: "approved" } });
      setReceipt(payload.detail ?? payload.receipt ?? "Approval recorded");
      setActiveStep(4);
      setPhase("approved");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Approval failed.");
    }
  };

  const compileSkill = async () => {
    if (!run || run.approval.status !== "approved") return;
    setError(null);
    try {
      setActiveStep(5);
      const response = await fetch("/api/skills/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          run,
          corrections: ["Lead with medication reconciliation when patient report conflicts with the active chart."],
        }),
      });
      if (!response.ok) throw new Error("The approved trace could not be compiled.");
      setCompiled((await response.json()) as CompiledSkill);
      setPhase("compiled");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Compilation failed.");
    }
  };

  const reset = () => selectScenario(scenarioId);
  const currentHandoff = run?.handoff;
  const isEscalation = currentHandoff?.disposition !== "clinician-review" && Boolean(currentHandoff);
  const displayedPatient = run?.patient ?? scenario.patient;
  const displayedInitials = run
    ? run.patient.displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()
    : scenario.patient.initials;

  const focusPatientIntake = () => {
    setActiveStep(0);
    const target = document.getElementById("patient-intake");
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ behavior: preferredScrollBehavior(), block: "center" });
  };

  const focusClinicianHandoff = () => {
    const target = document.getElementById("clinician-handoff");
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ behavior: preferredScrollBehavior(), block: "center" });
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <Image
            className="brand-wordmark"
            src="/brand/cely-wordmark.svg"
            alt="Cely"
            width={92}
            height={46}
            priority
          />
          <div>
            <div className="brand-subtitle">Clinical workflow intelligence</div>
          </div>
        </div>
        <div className="topbar-actions">
          <span
            className={`connection-status ${status === null ? "is-checking" : status.connected ? "is-live" : "is-fixture"}`}
            title={status?.detail}
            aria-live="polite"
          >
            <span className="status-dot" />
            {status === null ? "Checking Athena Preview" : status.connected ? "Athena Preview connected" : "Athena Preview fixture"}
          </span>
        </div>
      </header>

      <section className="hero">
        <div>
          <div className="eyebrow">Pre-visit intake</div>
          <h1>Every concern, clearly carried.</h1>
          <p>
            Cely turns patient concerns and chart context into an evidence-linked visit agenda, with patients
            and clinicians in control.
          </p>
        </div>
        <div className="hero-actions">
          {phase !== "idle" && (
            <button className="button button-secondary" onClick={reset} disabled={phase === "running"}>
              <RotateCcw size={15} /> Reset
            </button>
          )}
          <button
            className="button button-primary"
            onClick={() => run ? focusClinicianHandoff() : scenarioId === "luis-escalation" ? void runWorkflow() : focusPatientIntake()}
            disabled={phase === "running"}
          >
            {phase === "running"
              ? <><span className="spinner" /> Running workflow</>
              : <><Play size={15} fill="currentColor" /> {run ? "Review handoff" : scenarioId === "luis-escalation" ? "Run safety replay" : "Start patient intake"}</>}
          </button>
        </div>
      </section>

      <section className="workflow-rail" aria-label="Workflow execution">
        <div className="workflow-heading">
          <div>
            <span className="mono-label">previsit-intake-v1</span>
            <span className="workflow-version">6 governed stages</span>
          </div>
          <div className="workflow-policy"><LockKeyhole size={13} /> No autonomous writes</div>
        </div>
        <ol className="workflow-steps">
          {workflowSteps.map((step, index) => {
            const Icon = step.icon;
            const complete = activeStep > index || (phase === "compiled" && index === 5);
            const active = activeStep === index;
            return (
              <li
                className={`workflow-step ${complete ? "is-complete" : ""} ${active ? "is-active" : ""}`}
                key={step.label}
                aria-current={active ? "step" : undefined}
              >
                <div className="step-node">{complete ? <Check size={15} aria-hidden="true" /> : <Icon size={15} aria-hidden="true" />}</div>
                <div><strong>{step.label}</strong><span>{step.detail}</span></div>
              </li>
            );
          })}
        </ol>
      </section>

      {error && <div className="error-banner"><CircleAlert size={16} /> {error}</div>}

      <section className="runtime-grid">
        <article className="workspace-column conversation-panel">
          <div className="workspace-header">
            <div>
              <div className="panel-kicker">Patient intake</div>
              <h2>Describe what matters</h2>
            </div>
            <div className="scenario-switch" aria-label="Demo scenario">
              <button
                className={scenarioId === "maya-previsit" ? "selected" : ""}
                onClick={() => selectScenario("maya-previsit")}
                aria-pressed={scenarioId === "maya-previsit"}
                disabled={phase === "running"}
              >
                Standard
              </button>
              <button
                className={scenarioId === "luis-escalation" ? "selected" : ""}
                onClick={() => selectScenario("luis-escalation")}
                aria-pressed={scenarioId === "luis-escalation"}
                disabled={phase === "running"}
              >
                Red flag
              </button>
            </div>
          </div>

          <div className="patient-banner">
            <div className="avatar">{displayedInitials}</div>
            <div className="patient-meta">
              <strong>{displayedPatient.displayName}</strong>
              <span>
                {displayedPatient.age} · {intakeLanguage ? `${intakeLanguage} intake language · ` : ""}{displayedPatient.language} chart preference
                {run?.patient.identitySource === "athena" ? " · Athena linked" : ""}
              </span>
            </div>
            <div className="appointment-meta"><span>Upcoming</span><strong>{displayedPatient.appointment}</strong></div>
          </div>

          <div id="patient-intake" tabIndex={-1}>
            {scenarioId === "maya-previsit" ? (
              <PatientIntake
                key={`${scenarioId}-${intakeKey}`}
                patientName={displayedPatient.displayName.split(" ")[0]}
                patientInitials={displayedInitials}
                disabled={phase === "running" || Boolean(run)}
                onConfirmed={(intake) => void runWorkflow(intake)}
                onUrgent={(urgentIntake) => void runWorkflow(undefined, urgentIntake)}
              />
            ) : (
              <div className="conversation-stream">
                {scenario.conversation.map((message, index) => (
                  <div
                    className={`message-row is-visible ${message.speaker === "patient" ? "patient" : ""} ${message.speaker === "cely" && index > 0 ? "is-safety" : ""}`}
                    key={`${message.speaker}-${index}`}
                  >
                    <div className="message-bubble">
                      <div className="message-speaker">
                        {message.speaker === "cely" ? (index === 0 ? "Next question" : "Safety guidance") : "Patient words"}
                      </div>
                      <p>{message.text}</p>
                      {message.translated && <div className="translation"><Languages size={12} /> {message.translated}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <ul className="channel-notes">
            <li><Check size={14} aria-hidden="true" /> Original language preserved</li>
            <li><ShieldCheck size={14} aria-hidden="true" /> Bounded red-flag screen</li>
            <li title="Reset clears Cely's local in-memory intake; when live integrations are enabled, submitted data is processed by Claude and Athena Preview."><LockKeyhole size={14} aria-hidden="true" /> Session-only app state · live services process submissions</li>
          </ul>
        </article>

        <article
          id="clinician-handoff"
          className={`workspace-column handoff-panel ${isEscalation ? "is-escalation" : ""}`}
          tabIndex={-1}
        >
          <div className="workspace-header">
            <div>
              <div className="panel-kicker">Clinician review</div>
              <h2>Visit agenda</h2>
            </div>
            {run ? (
              <span className={`disposition-status ${isEscalation ? "urgent" : "ready"}`}>
                {isEscalation ? <CircleAlert size={13} /> : <BookOpenCheck size={13} />}
                {isEscalation ? "Escalated" : "Ready to review"}
              </span>
            ) : <span className="disposition-status waiting">Waiting for run</span>}
          </div>

          {!currentHandoff ? (
            <div className="empty-handoff">
              <FileCheck2 className="empty-icon" size={24} aria-hidden="true" />
              <strong>No clinician handoff yet.</strong>
              <p>Run the workflow to create an evidence-linked visit agenda for clinician review.</p>
            </div>
          ) : (
            <div className="handoff-content">
              <div className="handoff-title-row">
                <div><span>Priority handoff</span><h3>{currentHandoff.headline}</h3></div>
                <div className="confidence"><span>confidence</span><strong>{currentHandoff.confidence}</strong></div>
              </div>
              <p className="handoff-summary">{currentHandoff.summary}</p>

              <dl className="execution-metadata" aria-label="Workflow execution details">
                <div className={run.execution.athena === "live" || run.execution.athena === "partial" ? "is-live" : "is-fallback"}>
                  <dt>Athena</dt>
                  <dd>{run.execution.athena === "partial" ? "Live, partial" : run.execution.athena}</dd>
                </div>
                <div className={run.execution.model === "live" ? "is-live" : "is-fallback"}>
                  <dt>Model</dt>
                  <dd>{isEscalation ? "Bypassed" : `Sonnet 5, ${run.execution.model}`}</dd>
                </div>
                <div className="is-live">
                  <dt>Safety</dt>
                  <dd>Deterministic</dd>
                </div>
              </dl>

              {traceMetrics ? (
                <dl className="trace-metrics" aria-label="Measured workflow trace">
                  <div><dt>Patient topic{traceMetrics.concernCount === 1 ? "" : "s"}</dt><dd>{traceMetrics.concernCount}</dd></div>
                  {traceMetrics.handoffDurationMs !== null ? <div><dt>To handoff</dt><dd>{(traceMetrics.handoffDurationMs / 1000).toFixed(1)}s</dd></div> : null}
                  <div><dt>Athena fact{traceMetrics.athenaEvidenceCount === 1 ? "" : "s"}</dt><dd>{traceMetrics.athenaEvidenceCount}</dd></div>
                  <div><dt>Citations resolved</dt><dd>{traceMetrics.agendaEvidenceCoverage.percent}%</dd></div>
                  <div><dt>Autonomous writes</dt><dd>{traceMetrics.autonomousWrites}</dd></div>
                </dl>
              ) : null}

              {orderedPatientConcerns.length > 0 ? (
                <section className="patient-priorities">
                  <div className="patient-priorities-heading">
                    <div><Languages size={14} /><strong>Patient-confirmed priorities</strong></div>
                    <span>Preference, not clinical urgency</span>
                  </div>
                  <ol>
                    {orderedPatientConcerns.map((concern, index) => (
                      <li key={concern.id}>
                        <span>{index + 1}</span>
                        <div>
                          <strong>{concern.translated ?? concern.patientWords}</strong>
                          <small>{concern.patientWords}</small>
                        </div>
                        {concern.patientPriority === "top" ? <span className="priority-status">Patient&apos;s top priority</span> : null}
                      </li>
                    ))}
                  </ol>
                  {!orderedPatientConcerns.some((concern) => concern.patientPriority === "top") ? <p>No single top priority selected; mention order is preserved.</p> : null}
                </section>
              ) : null}

              <div className="handoff-section">
                <h4>Clinical visit agenda</h4>
                <ol>
                  {currentHandoff.agenda.map((item, index) => (
                    <li key={`${item.label}-${index}`}>
                      <span className="agenda-number">{index + 1}</span>
                      <div className="agenda-item-copy">
                        <strong>{item.label}</strong>
                        <p>{item.rationale}</p>
                        <div className="agenda-support" aria-label="Supporting evidence">
                          {item.evidenceIds.map((evidenceId) => {
                            const evidence = run.evidence.find((candidate) => candidate.id === evidenceId);
                            return (
                              <div className="agenda-citation" key={evidenceId} title={evidenceId}>
                                {evidence ? <SourceLabel source={evidence.source} /> : null}
                                <small>{evidence?.value ?? evidenceId}</small>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {currentHandoff.discrepancies.length > 0 && (
                <div className="discrepancy-callout">
                  <div><CircleAlert size={15} /><strong>Needs reconciliation</strong></div>
                  <p>{currentHandoff.discrepancies[0]}</p>
                </div>
              )}

              <div className="evidence-list">
                <div className="section-label">Evidence ledger</div>
                {run.evidence.slice(0, 6).map((item) => (
                  <div className="evidence-row" key={item.id}>
                    <SourceLabel source={item.source} />
                    <div><strong>{item.value}</strong><span>{item.resource ?? item.label}{item.observedAt ? ` · ${item.observedAt}` : ""}</span></div>
                  </div>
                ))}
              </div>

              <div className="approval-box">
                <div className="approval-copy">
                  <div className="approval-icon"><LockKeyhole size={15} /></div>
                  <div><strong>{run.approval.status === "approved" ? "Approved by clinician" : "Human approval required"}</strong><span>{receipt ?? "No Athena mutation can occur before this checkpoint."}</span></div>
                </div>
                {run.approval.status === "pending" ? (
                  <button className="button button-approve" onClick={() => void approveRun()}>
                    <UserRoundCheck size={15} /> {isEscalation ? "Acknowledge escalation" : "Approve handoff"}
                  </button>
                ) : (
                  <button className="button button-compile" onClick={() => void compileSkill()} disabled={phase === "compiled"}>
                    <Code2 size={15} /> {phase === "compiled" ? "Skill compiled" : "Compile into skill"}
                  </button>
                )}
              </div>
              <div className="interpreter-limitation"><Languages size={13} /> This pre-visit communication aid does not replace a qualified interpreter during the clinical encounter.</div>
            </div>
          )}
        </article>
      </section>

      {compiled && (
        <section className="compiled-section">
          <div className="compiled-copy">
            <div>
              <div className="panel-kicker">Governed skill</div>
              <h2><code>/{compiled.name}</code> is ready to test</h2>
              <p>The approved workflow is packaged with its instructions, permissions, and test trace.</p>
              <ul className="compiled-files">{compiled.files.map((file) => <li key={file.path}><FileCheck2 size={13} aria-hidden="true" /> {file.path}</li>)}</ul>
            </div>
          </div>
          <div className="code-preview">
            <div className="code-header"><span>skills/{compiled.name}/SKILL.md</span><span>v{compiled.version}</span></div>
            <pre>{compiled.files.find((file) => file.path === "SKILL.md")?.content.split("\n").slice(0, 18).join("\n")}</pre>
          </div>
        </section>
      )}

      <footer className="audit-trail">
        <div><Activity size={14} /><span>Audit trail</span><strong>{run?.runId ?? "No run yet"}</strong></div>
        <div className="audit-events">
          <span className={activeStep >= 0 ? "done" : ""}>Intake captured</span><ArrowRight size={12} />
          <span className={activeStep >= 2 ? "done" : ""}>Policy evaluated</span><ArrowRight size={12} />
          <span className={run ? "done" : ""}>Handoff produced</span><ArrowRight size={12} />
          <span className={run?.approval.status === "approved" ? "done" : ""}>Human approved</span><ArrowRight size={12} />
          <span className={compiled ? "done" : ""}>Skill versioned</span>
        </div>
      </footer>
    </main>
  );
}
