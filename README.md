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

Real questionnaire and Pavlovia URLs have not been inserted. Questionnaire 2 can be disabled later by setting `enabled` to `false` in `config.json` without changing controller code.

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


## Questionnaire routing

Current development sequence is:

`Questionnaire 1 → Questionnaire 2 → four PID-assigned tasks → completion`

If the final study uses only one questionnaire, set `questionnaire_2.enabled` to `false`. The controller automatically removes it from the participant sequence.

## Development test controls

The private development interface now includes a test panel when `config.json` uses `"mode": "development"`.

It can simulate correct returns, deliberate wrong returns, page reloads, and session resets without requiring live questionnaire or Pavlovia links.

See `DEV_TEST_PLAN.md` for the validation checklist.

## Participant-facing terminology

Participant-facing screens use neutral language:
- Online Study
- Study Part 1 / Study Part 2
- Activity 1 of 4 through Activity 4 of 4
- Previous part completed
- Study complete

Scientific task names, counterbalancing variables, questionnaire IDs, and routing details remain internal only.

## Browser validation evidence

Validated in-browser during development mode:

- P001 / TESTA00001
  - O13
  - Key Group A
  - VS target Blue Circle
  - VS block order A
  - completed sequence: questionnaire_1 → questionnaire_2 → visuospatial_nback → pro_anti → verbal_nback → visual_search
  - final completion reached
  - deliberate wrong-return test blocked progression

- P003 / TESTB00003
  - O19
  - Key Group B
  - VS target Red Circle
  - VS block order A
  - completed sequence: questionnaire_1 → questionnaire_2 → visual_search → pro_anti → verbal_nback → visuospatial_nback
  - final completion reached

Current controller core status: VALIDATED IMPLEMENTATION in development mode.

## Live questionnaire integration

The controller now uses one live Qualtrics questionnaire before the task sequence.

- questionnaire_1: live Qualtrics URL connected
- questionnaire_2: disabled
- four task URLs remain development dummies

The controller appends the participant query parameter to the questionnaire launch URL.
The Qualtrics completion redirect back to the controller still needs to be configured in Qualtrics before end-to-end live validation.

## Pavlovia URL integration

Connected using clean participant-facing run URLs only:

- Pro/Anti-saccade → APS
- Visual Search → FCS
- Visuospatial N-back → NBS

Verbal N-back remains on the development dummy because the fourth supplied URL duplicated NBS.

Pilot/OAuth query tokens are intentionally excluded from GitHub configuration.

## One-sitting browser lock

Development controller now uses two browser storage layers:

- `sessionStorage`: active within the current tab/session and carries routing state.
- `localStorage`: persistent PID status lock for the same browser.

On successful entry, the controller records the PID as `started`.
On final completion, it records the PID as `completed`.
If the browser/tab is closed and the same PID attempts to start again in the same browser, ordinary re-entry is blocked.

This is a browser-level operational safeguard. A purely static GitHub Pages controller cannot enforce a global cross-browser/cross-device lock without a server-side service.

Development reset clears both stores so test sessions can be repeated.
