# Development controller test plan

These checks are for the private development version only.

## Test credentials

- P001 / TESTA00001
- P003 / TESTB00003

## Expected routing checks

For each test PID:

1. Correct PID + UID is accepted.
2. Wrong UID is rejected.
3. Before-you-begin acknowledgement appears.
4. Reloading the page preserves the active session.
5. Questionnaire 1 is first.
6. A valid simulated return advances to Questionnaire 2.
7. Questionnaire 2 advances to the first PID-assigned task.
8. Each valid return advances exactly one component.
9. The four tasks follow the PID's authoritative O01-O24 order.
10. Final completion appears only after the full sequence.

## Error checks

1. Invalid PID is rejected.
2. Wrong UID is rejected.
3. Unexpected return produces an error and does not advance.
4. Missing session + return query produces a session-verification error.
5. Missing task-order definition fails closed.
6. Missing allocation fails closed.

## Development controls

When `config.json` has `"mode": "development"`, the interface exposes:

- Simulate expected return
- Simulate wrong return
- Reload page
- Reset test session
- internal metadata for PID/order/key group/Visual Search allocation/current state

These controls are omitted when mode is changed away from `development`.

No real participant data or real task data are collected by these tests.
