# CDNL Executive Attention Study controller

Current status: private development repository.

This repository contains the candidate static participant-facing controller.

## Current implementation

Implemented:
- static HTML/CSS/JavaScript controller;
- 384-participant counterbalancing lookup;
- corrected red/blue Visual Search targets;
- Visual Search block-order A/B allocation;
- Participant ID + Study UID entry;
- derived UID verification using SHA-256;
- no plaintext UID list in the controller;
- browser `sessionStorage` one-sitting session state;
- "Before you begin" acknowledgement screen;
- fail-closed invalid PID / mismatched UID behavior.

Development-only:
- `uid_verifiers_DEV.json` contains derived verifiers for test PIDs only.
- Final participant UIDs have not been generated or loaded.
- questionnaire routing is not connected;
- Pavlovia URLs are not connected;
- return/completion routing is not connected.

## Public/private boundary

Never deploy participant-identifying information here.

Do not include:
- names;
- emails;
- SONA identifiers;
- consent records;
- dates of birth;
- student numbers;
- identity ↔ PID ↔ UID linkage;
- plaintext UID credentials.

The eventual public deployment may contain only the derived UID verification records needed for operational routing.

## Development test credentials

For local/private development only:

- P001 / TESTA00001
- P003 / TESTB00003

These are test credentials and must not be used for participants.

## One-sitting behavior

The controller stores active study state in `sessionStorage`.

This supports:
- normal page refresh;
- navigation to an external task and return within the same browser tab/session.

Closing the tab/browser ends ordinary browser-session state. This is an operational study-session control, not high-security authentication.
