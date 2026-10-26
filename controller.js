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

async function boot() {
  const status = document.getElementById("status");
  const details = document.getElementById("details");

  try {
    const [configResponse, csvText] = await Promise.all([
      fetch("config.json", { cache: "no-store" }),
      loadText("participant_counterbalance_lookup.csv")
    ]);

    if (!configResponse.ok) throw new Error("Could not load config.json");
    const config = await configResponse.json();
    const rows = parseCsv(csvText);

    if (rows.length !== 384) throw new Error(`Expected 384 allocation rows; found ${rows.length}`);

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

    status.textContent = "Study controller foundation loaded successfully.";
    details.hidden = false;
    details.innerHTML = `
      <strong>Configuration check passed.</strong><br>
      384 participant allocations loaded.<br>
      Visual Search targets: red/blue circle/square.<br>
      Visual Search block orders: A/B.<br>
      Live study routing is not enabled yet.
    `;
    document.title = config.study_title || "Executive Attention Study";
  } catch (error) {
    status.textContent = "Study controller could not load.";
    details.hidden = false;
    details.classList.add("error");
    details.textContent = error.message;
  }
}

window.addEventListener("DOMContentLoaded", boot);
