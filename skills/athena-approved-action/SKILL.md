---
name: athena-approved-action
description: Validate, execute, and verify a human-approved write to Athena Preview. Use when a clinician or nurse has reviewed an agent-generated artifact and wants to create an appointment note or another explicitly allowed chart action with an auditable receipt; never use for autonomous or production writes.
---

# Athena approved action

## Gate the write

1. Require the approved artifact, source run ID, target patient or appointment, actor role, and explicit approval signal.
2. Reject agent self-approval, missing targets, empty payloads, production targets, and actions outside the allowlist.
3. Present the final target and payload to the human before mutation.
4. Keep live writeback behind a separate environment flag even after approval.

## Execute and verify

1. Use the Athena Preview 2-legged server token.
2. Encode the request exactly as the documented endpoint requires.
3. Record status, target, action, source run, actor role, and timestamp without storing credentials or PHI in logs.
4. Read back the created object when the endpoint supports verification.
5. Return a receipt. If verification fails, report uncertain completion and route to a human; do not retry blindly.
