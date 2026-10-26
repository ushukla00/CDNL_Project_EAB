const SESSION_KEY = "eab_study_session_v2";

let CONFIG = null;
let ALLOCATIONS = new Map();
let VERIFIERS = {};
let TASK_ORDERS = {};

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

function participantSequence(pid) {
  const assignment = ALLOCATIONS.get(pid);
  if (!assignment) throw new Error("Participant allocation unavailable.");

  const order = TASK_ORDERS[assignment.task_order_id];
  if (!Array.isArray(order) || order.length !== 4) {
    throw new Error("Task-order definition unavailable.");
  }

  const sequence = [];

  for (const q of CONFIG.questionnaires || []) {
    if (q.enabled !== false) {
      sequence.push({
        id: q.id,
        kind: "questionnaire",
        label: q.label || "Study Part",
        url: q.url
      });
    }
  }

  for (const taskName of order) {
    const task = CONFIG.tasks[taskName];
    if (!task) throw new Error(`Task configuration missing for ${taskName}`);
    sequence.push({
      id: task.id,
      kind: "task",
      taskName,
      label: "Task",
      url: task.url
    });
  }

  return sequence;
}


function devMeta(state) {
  if (CONFIG.mode !== "development") return "";
  const assignment = ALLOCATIONS.get(state.pid);
  const sequence = participantSequence(state.pid);
  const current = sequence[state.currentIndex] || null;
  return [
    `PID: ${state.pid}`,
    `Task order: ${assignment?.task_order_id || "n/a"}`,
    `Key group: ${assignment?.key_group || "n/a"}`,
    `VS target: ${assignment?.vs_target || "n/a"}`,
    `VS block order: ${assignment?.vs_block_order || "n/a"}`,
    `Current index: ${state.currentIndex}`,
    `Current component: ${current?.id || "complete"}`,
    `Expected return: ${state.expectedReturn || "none"}`,
    `Completed: ${state.completed.join(", ") || "none"}`
  ].join("\n");
}

function devPanel(state) {
  if (CONFIG.mode !== "development") return "";
  return `
    <section class="dev-panel">
      <h2>Development controls</h2>
      <div class="dev-grid">
        <button type="button" id="dev-valid-return">Simulate expected return</button>
        <button type="button" id="dev-wrong-return">Simulate wrong return</button>
        <button type="button" id="dev-refresh">Reload page</button>
        <button type="button" id="dev-reset" class="danger">Reset test session</button>
      </div>
      <div class="dev-meta">${devMeta(state)}</div>
    </section>
  `;
}

function bindDevPanel(state) {
  if (CONFIG.mode !== "development") return;

  const valid = document.getElementById("dev-valid-return");
  if (valid) {
    valid.addEventListener("click", () => {
      const sequence = participantSequence(state.pid);
      const current = sequence[state.currentIndex];
      if (!current) return;
      state.expectedReturn = current.id;
      saveSession(state);
      window.location.href = `index.html?return=${encodeURIComponent(current.id)}`;
    });
  }

  const wrong = document.getElementById("dev-wrong-return");
  if (wrong) {
    wrong.addEventListener("click", () => {
      const sequence = participantSequence(state.pid);
      const current = sequence[state.currentIndex];
      if (!current) return;
      state.expectedReturn = current.id;
      saveSession(state);
      const wrongId = current.id === "pro_anti" ? "visual_search" : "pro_anti";
      window.location.href = `index.html?return=${encodeURIComponent(wrongId)}`;
    });
  }

  const refresh = document.getElementById("dev-refresh");
  if (refresh) refresh.addEventListener("click", () => window.location.reload());

  const reset = document.getElementById("dev-reset");
  if (reset) {
    reset.addEventListener("click", () => {
      sessionStorage.removeItem(SESSION_KEY);
      window.location.href = "index.html";
    });
  }
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
    ${CONFIG.mode === "development" ? '<div class="dev">Development mode. Final participant credentials and live study links are not loaded.</div>' : ""}
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
    version: 2,
    pid,
    sessionActive: true,
    rulesAcknowledged: false,
    currentIndex: 0,
    expectedReturn: null,
    completed: [],
    startedAt: new Date().toISOString()
  };

  saveSession(state);
  cleanReturnQuery();
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
    ${devPanel(state)}
  `);

  bindDevPanel(state);

  document.getElementById("acknowledge").addEventListener("click", () => {
    state.rulesAcknowledged = true;
    saveSession(state);
    renderCurrent(state);
  });
}

function taskOrdinal(sequence, index) {
  return sequence.slice(0, index + 1).filter(c => c.kind === "task").length;
}

function progressHtml(sequence, state) {
  return `<div class="progress">${sequence.map((_, i) => {
    const cls = i < state.currentIndex ? "done" : i === state.currentIndex ? "current" : "";
    return `<div class="progress-step ${cls}"></div>`;
  }).join("")}</div>`;
}

function renderCurrent(state) {
  const sequence = participantSequence(state.pid);

  if (state.currentIndex >= sequence.length) {
    renderComplete(state);
    return;
  }

  const component = sequence[state.currentIndex];
  const number = taskOrdinal(sequence, state.currentIndex);

  const title = component.kind === "questionnaire"
    ? component.label
    : `Task ${number} of 4`;

  const previousCompleted = state.currentIndex > 0
    ? `<div class="notice"><strong>Previous part completed.</strong><br>You may take a short break. Keep this browser tab open and continue when you are ready.</div>`
    : "";

  render(`
    <h1>${title}</h1>
    <p class="muted">Participant ID: <strong>${state.pid}</strong></p>
    ${progressHtml(sequence, state)}
    <p class="muted">Component ${state.currentIndex + 1} of ${sequence.length}</p>
    ${previousCompleted}
    <p>Continue when you are ready. The next part of the study will open from this page.</p>
    <button id="launch">Start ${component.kind === "task" ? `Activity ${number}` : "this part"}</button>
    ${CONFIG.mode === "development" ? '<div class="dev">Development mode: this opens a dummy component page.</div>' : ""}
    ${devPanel(state)}
  `);

  document.getElementById("launch").addEventListener("click", () => launchComponent(state, component));
  bindDevPanel(state);
}

function launchComponent(state, component) {
  if (!component.url) {
    renderCurrentError(state, "This part of the study is not available yet.");
    return;
  }

  state.expectedReturn = component.id;
  saveSession(state);

  const sep = component.url.includes("?") ? "&" : "?";
  const url = `${component.url}${sep}${encodeURIComponent(CONFIG.participant_query_parameter)}=${encodeURIComponent(state.pid)}`;
  window.location.href = url;
}

function renderCurrentError(state, message) {
  render(`
    <h1>Study part unavailable</h1>
    <div class="error">${message}</div>
    <button id="back">Return to study</button>
  `);
  document.getElementById("back").addEventListener("click", () => renderCurrent(state));
}

function handleReturn(state, returnedComponent) {
  if (!returnedComponent) return false;

  if (!state.expectedReturn) {
    renderReturnError("No study part was expected to return.");
    return true;
  }

  if (returnedComponent !== state.expectedReturn) {
    renderReturnError("This part of the study was not expected. Your progress has not changed.");
    return true;
  }

  const sequence = participantSequence(state.pid);
  const current = sequence[state.currentIndex];

  if (!current || current.id !== returnedComponent) {
    renderReturnError("This return does not match the current part of the study.");
    return true;
  }

  if (!state.completed.includes(returnedComponent)) {
    state.completed.push(returnedComponent);
  }
  state.currentIndex += 1;
  state.expectedReturn = null;
  saveSession(state);
  cleanReturnQuery();
  renderCurrent(state);
  return true;
}

function renderReturnError(message) {
  render(`
    <h1>Study session error</h1>
    <div class="error">${message}</div>
    <p>Please do not restart the study with a different code.</p>
  `);
}

function renderComplete(state) {
  state.sessionActive = false;
  state.completedAt = new Date().toISOString();
  saveSession(state);

  render(`
    <h1>Study complete</h1>
    <div class="notice"><strong>You have completed all parts of the study.</strong></div>
    <p>Thank you. You may now close this browser tab.</p>
    <p class="muted">Participant ID: ${state.pid}</p>
    ${CONFIG.mode === "development" ? '<div class="dev">Development completion only. No real task data were collected.</div>' : ""}
    ${devPanel(state)}
  `);
  bindDevPanel(state);
}

function cleanReturnQuery() {
  if (window.location.search) {
    history.replaceState({}, document.title, window.location.pathname);
  }
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

  const orderIds = new Set(rows.map(r => r.task_order_id));
  if (orderIds.size !== 24) throw new Error("Expected 24 task-order IDs.");
  for (const id of orderIds) {
    if (!TASK_ORDERS[id]) throw new Error(`Missing task-order definition: ${id}`);
  }
}

async function boot() {
  try {
    const configResponse = await fetch("config.json", { cache: "no-store" });
    if (!configResponse.ok) throw new Error("Could not load config.json");
    CONFIG = await configResponse.json();

    const [csvText, verifierResponse, taskOrderResponse] = await Promise.all([
      loadText("participant_counterbalance_lookup.csv"),
      fetch(CONFIG.verification_file, { cache: "no-store" }),
      fetch(CONFIG.task_order_file, { cache: "no-store" })
    ]);

    if (!verifierResponse.ok) throw new Error("Could not load UID verification data");
    if (!taskOrderResponse.ok) throw new Error("Could not load task-order definitions");

    VERIFIERS = await verifierResponse.json();
    TASK_ORDERS = await taskOrderResponse.json();

    const rows = parseCsv(csvText);
    ALLOCATIONS = new Map(rows.map(row => [row.pid, row]));
    validateFoundation(rows);

    document.title = CONFIG.study_title || "Executive Attention Study";

    const returnedComponent = new URLSearchParams(window.location.search).get("return");
    const state = getSession();

    if (!state) {
      if (returnedComponent) {
        renderReturnError("Study session could not be verified.");
      } else {
        renderLogin();
      }
      return;
    }

    if (!state.sessionActive && state.currentIndex < participantSequence(state.pid).length) {
      sessionStorage.removeItem(SESSION_KEY);
      renderLogin("Study session could not be verified.");
      return;
    }

    if (returnedComponent && handleReturn(state, returnedComponent)) return;

    if (!state.rulesAcknowledged) {
      renderBeforeBegin(state);
    } else if (state.currentIndex >= participantSequence(state.pid).length) {
      renderComplete(state);
    } else {
      renderCurrent(state);
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
