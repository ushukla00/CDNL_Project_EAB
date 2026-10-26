# CDNL Executive Attention Study controller

Current status: private development repository.

## Implemented

- static HTML/CSS/JavaScript controller;
- 384-participant counterbalancing lookup;
- corrected red/blue Visual Search targets;
- Visual Search block-order A/B allocation;
- authoritative O01–O24 task-order map;
- Participant ID + Study UID entry;
- derived UID verification using SHA-256;
- no plaintext UID list in the controller;
- browser `sessionStorage` one-sitting session state;
- "Before you begin" acknowledgement screen;
- frozen task-order routing;
- only the current component is exposed;
- expected-return validation;
- component completion advances exactly one step;
- break/transition state between components;
- final completion state;
- dummy external-component page for development testing;
- fail-closed invalid PID, mismatched UID, missing allocation, and unexpected-return behavior.

## Development-only test credentials

- P001 / TESTA00001
- P003 / TESTB00003

These are development credentials only.

## Current dummy routing

The four task URLs currently point to `dummy.html`.

The dummy page simulates:
controller → external component → successful return → controller.

Real questionnaire and Pavlovia URLs have not been inserted.

## Public/private boundary

Never include:
- names;
- emails;
- SONA identifiers;
- consent records;
- dates of birth;
- student numbers;
- identity ↔ PID ↔ UID linkage;
- plaintext UID credentials.

## Next implementation phase

Validate the routing state machine in-browser while private/local, then connect questionnaire routing and later real Pavlovia URLs.
