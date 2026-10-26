# Public study-site deployment surface

This folder is the candidate static deployment surface for `ushukla00/PhD-study-site`.

It is intentionally limited to participant-facing static assets.

Safe to publish:
- `index.html`
- `styles.css`
- `controller.js`
- `config.json`
- `participant_counterbalance_lookup.csv`
- `.nojekyll`

Do not publish here:
- names, emails, SONA identifiers, consent records, dates of birth, student numbers;
- identity ↔ PID ↔ UID linkage;
- plaintext UID credentials;
- test credential files;
- Flask/SQLite application files;
- researcher reset/import/generation utilities.

Current scope: hosting foundation and static allocation/configuration validation only.
Participant login, UID verification, routing, and completion logic are later phases.
