# Codex instructions — CNC daily report TEST frontend

## Scope
- This repository (`winniehsu1018/drtesting`) is the TEST frontend for the CNC production daily report. The main frontend file is `index.html`.
- Related GAS source is in the separate PRIVATE repository `winniehsu1018/CNC-GAS-Backend` (four .gs files and `appsscript.json`). The test Apps Script project is distinct from the production project.
- The production frontend is `winniehsu1018/daily-report`. Do not modify it.
- Do not assume the test frontend points to the test GAS endpoint: inspect actual URLs and report any mismatch before attempting changes.

## Analysis priorities
1. Trace frontend API calls, request/response payloads, errors, authentication/PIN and access checks.
2. Compare with backend handlers when the backend files are actually available; do not invent their behavior.
3. Validate zero-quantity reports, requestId/idempotency, machine/part selection, timestamps and shift accounting.
4. For shift settlement, account for production and idle time, avoid duplicate cleaning and inspection deductions, and enforce administrator-only corrections after employee confirmation.
5. Identify impacts on Google Sheet column mappings, existing production data and user workflows.

## Safety and change workflow
- Analysis is read-only by default. Before edits, explain affected files, risks, and test cases.
- Work on a separate branch or pull request for code changes; do not push directly to the production frontend or production GAS.
- Do not deploy, change GAS project settings, write to Google Sheets, change API endpoints, or modify secrets without explicit user approval.
- Never paste secrets, PINs, OAuth tokens or private data into source or logs.
- Offline/static checks cannot verify live Google Apps Script or Sheet integration; state this limitation.
- When backend source is unavailable in the current Codex environment, ask for access or a user-provided snapshot; do not claim cross-repository analysis is complete.
