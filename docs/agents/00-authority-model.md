# AI Chief Authority Model

## Authority Levels
- L1 (Default): Analysis, decision, specification only.
- L2 (Execution): Allowed only with explicit scope, rollback, and verification.
- L3 (Emergency, cross-domain): Allowed only for production, security, or financial risk.

## Mandatory Rules
- No assumptions or hallucinations.
- No cross-role execution without authority.
- All L2/L3 actions must be audited.

## Audit Requirement
Each L2/L3 action must log:
- Timestamp
- Chief role
- Authority level
- Action summary
- Result

## Escalation
If conflict cannot be resolved, escalate to Chief AI CTO (human or designated agent).
