const SESSION_KEY = "eab_study_session_v1";

let CONFIG = null;
let ALLOCATIONS = new Map();
let VERIFIERS = {};

async function loadText(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return response.text();
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",");
  return lines.slice(1).map(line => {
    const values = line.split(",");
    return Object.fromEntries(header.map((key, i) => [key, values[i]]));
  });
}

function normalizePid(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeUid(value) {
  return String(value || "").trim().toUpperCase();
}

function validPidFormat(pid) {
  return /^P\d{3}$/.test(pid);
}

function bufferToHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function deriveVerifier(pid, uid, salt) {
  const payload = new TextEncoder().encode(`${pid}|${uid}|${salt}`);
  const digest = await crypto.subtle.digest("SHA-256", payload);
  return bufferToHex(digest);
}

function getSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function saveSession(state) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
}

function render(html) {
  document.getElementById("app").innerHTML = html;
}

function renderLogin(error = "") {
  render(`
    <h1>${CONFIG.study_title}</h1>
    <p>Enter the two study codes provided by the research team. You will enter them once at the start of this study session.</p>
    ${error ? `<div class="error">${error}</div>` : ""}
    <form id="login-form" autocomplete="off">
      <label for="pid">Participant ID</label>
      <input id="pid" name="pid" maxlength="4" placeholder="P001" required>

      <label for="uid">Study UID</label>
      <input id="uid" name="uid" maxlength="20" placeholder="Study UID" required>

      <button type="submit">Verify study codes</button>
    </form>
    <p class="muted">Your identifying registration information is kept separately from this study controller.</p>
    ${CONFIG.mode === "development" ? '<div class="dev">Development verification mode. Final participant credentials have not been loaded.</div>' : ""}
  `);

  document.getElementById("login-form").addEventListener("submit", handleLogin);
}

async function handleLogin(event) {
  event.preventDefault();

  const pid = normalizePid(document.getElementById("pid").value);
  const uid = normalizeUid(document.getElementById("uid").value);

  if (!validPidFormat(pid) || !ALLOCATIONS.has(pid)) {
    renderLogin("Study ID not recognized. Check the code exactly as provided.");
    return;
  }

  const record = VERIFIERS[pid];
  if (!record) {
    renderLogin(
      CONFIG.mode === "development"
        ? "This PID has no development UID verifier yet."
        : "Study codes could not be verified. Please contact the research team."
    );
    return;
  }

  const derived = await deriveVerifier(pid, uid, record.salt);
  if (derived !== record.verifier) {
    renderLogin("The two study codes do not match. Check both codes exactly as provided.");
    return;
  }

  const state = {
    version: 1,
    pid,
    sessionActive: true,
    rulesAcknowledged: false,
    currentStage: "verified",
    currentComponent: null,
    expectedReturn: null,
    completed: [],
    startedAt: new Date().toISOString()
  };

  saveSession(state);
  renderBeforeBegin(state);
}

function renderBeforeBegin(state) {
  render(`
    <h1>Before you begin</h1>
    <p>Your study codes have been verified.</p>

    <div class="notice"><strong>Please complete the study in one sitting.</strong></div>

    <p>During the session:</p>
    <ul>
      <li>Keep this browser tab open.</li>
      <li>Complete each component in the order shown.</li>
      <li>You may take short breaks when the study page offers them.</li>
      <li>Do not close the study and return later.</li>
      <li>Your study data use your Participant ID rather than your identifying registration information.</li>
    </ul>

    <button id="acknowledge">I understand — begin study</button>
    <p class="muted">Participant ID: ${state.pid}</p>
  `);

  document.getElementById("acknowledge").addEventListener("click", () => {
    state.rulesAcknowledged = true;
    state.currentStage = "ready";
    saveSession(state);
    renderReady(state);
  });
}

function renderReady(state) {
  render(`
    <h1>Study session ready</h1>
    <div class="notice"><strong>Study codes verified and one-sitting session initialized.</strong></div>
    <p>The questionnaire/task routing layer will be connected in the next implementation phase.</p>
    <p class="muted">Participant ID: ${state.pid}</p>
    ${CONFIG.mode === "development" ? '<div class="dev">Development mode: routing is intentionally disabled.</div>' : ""}
  `);
}

function validateFoundation(rows) {
  if (rows.length !== 384) {
    throw new Error(`Expected 384 allocation rows; found ${rows.length}`);
  }

  const pids = new Set(rows.map(r => r.pid));
  if (pids.size !== 384) throw new Error("PID values are not unique");

  const expectedTargets = new Set(["Red Circle", "Red Square", "Blue Circle", "Blue Square"]);
  const actualTargets = new Set(rows.map(r => r.vs_target));
  if (actualTargets.size !== 4 || [...actualTargets].some(x => !expectedTargets.has(x))) {
    throw new Error("Visual Search targets do not match the approved red/blue set");
  }

  const blockOrders = new Set(rows.map(r => r.vs_block_order));
  if (blockOrders.size !== 2 || !blockOrders.has("A") || !blockOrders.has("B")) {
    throw new Error("Visual Search block-order allocation is invalid");
  }
}

async function boot() {
  try {
    const configResponse = await fetch("config.json", { cache: "no-store" });
    if (!configResponse.ok) throw new Error("Could not load config.json");
    CONFIG = await configResponse.json();

    const [csvText, verifierResponse] = await Promise.all([
      loadText("participant_counterbalance_lookup.csv"),
      fetch(CONFIG.verification_file, { cache: "no-store" })
    ]);

    if (!verifierResponse.ok) throw new Error("Could not load UID verification data");
    VERIFIERS = await verifierResponse.json();

    const rows = parseCsv(csvText);
    validateFoundation(rows);
    ALLOCATIONS = new Map(rows.map(row => [row.pid, row]));

    document.title = CONFIG.study_title || "Executive Attention Study";

    const state = getSession();
    if (!state) {
      renderLogin();
    } else if (!state.sessionActive || !ALLOCATIONS.has(state.pid)) {
      sessionStorage.removeItem(SESSION_KEY);
      renderLogin("Study session could not be verified.");
    } else if (!state.rulesAcknowledged) {
      renderBeforeBegin(state);
    } else {
      renderReady(state);
    }
  } catch (error) {
    render(`
      <h1>Study unavailable</h1>
      <div class="error">${error.message}</div>
      <p>Please contact the research team.</p>
    `);
  }
}

window.addEventListener("DOMContentLoaded", boot);
