async function send(message) {
  let response;
  try {
    response = await chrome.runtime.sendMessage(message);
  } catch (error) {
    if (/Receiving end does not exist|Could not establish connection|Extension context invalidated/i.test(error.message)) throw new Error("Reload Locked In at chrome://extensions, then reopen settings and try again. If it still fails, check the extension’s Errors panel.");
    throw error;
  }
  if (!response) throw new Error("Reload Locked In at chrome://extensions, then reopen settings and try again.");
  if (response?.error) throw new Error(response.error);
}

let progressSignature = "";
let domainsSignature = "";

async function render() {
  await send({ type: "status" });
  const { blocked = [], focusUntil = 0, unlockRequest = null, progress = {}, focusSession = null } = await chrome.storage.local.get(["blocked", "focusUntil", "unlockRequest", "progress", "focusSession"]);
  const locked = focusUntil > Date.now();
  document.getElementById("startFocus").disabled = locked;
  const remaining = Math.max(0, Math.ceil((focusUntil - Date.now()) / 1000));
  document.getElementById("focusStatus").textContent = locked ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")} remaining` : "Ready when you are.";
  const meter = document.getElementById("sessionProgress");
  meter.hidden = !locked || !focusSession;
  meter.value = focusSession ? Math.min(100, Math.max(0, 100 * (1 - remaining / (focusSession.minutes * 60)))) : 0;
  document.getElementById("unlockPanel").hidden = !locked;
  document.getElementById("unlockForm").hidden = Boolean(unlockRequest);
  const seconds = unlockRequest ? Math.max(0, Math.ceil((unlockRequest.readyAt - Date.now()) / 1000)) : 0;
  document.getElementById("unlockStatus").textContent = unlockRequest ? `${unlockRequest.reason} — ${seconds ? `Wait ${seconds}s before confirming.` : "You can now confirm or keep focusing."}` : "";
  document.getElementById("confirmUnlock").hidden = !unlockRequest;
  document.getElementById("confirmUnlock").disabled = seconds > 0;
  document.getElementById("cancelUnlock").hidden = !unlockRequest;
  const nextProgressSignature = JSON.stringify([progress, new Date().toDateString()]);
  if (nextProgressSignature !== progressSignature) {
    renderProgress(progress);
    progressSignature = nextProgressSignature;
  }
  const nextDomainsSignature = JSON.stringify([Domains.clean(blocked), locked]);
  if (nextDomainsSignature === domainsSignature) return;
  domainsSignature = nextDomainsSignature;
  const list = document.getElementById("domains");
  list.replaceChildren();
  for (const domain of Domains.clean(blocked)) {
    const item = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = domain;
    const remove = document.createElement("button");
    remove.textContent = "Remove";
    remove.disabled = locked;
    remove.onclick = async () => {
      try { await send({ type: "remove", domain }); } catch (error) { document.getElementById("status").textContent = error.message; }
    };
    item.append(name, remove);
    list.append(item);
  }
}
function renderProgress(progress) {
  const totals = Object.values(progress).reduce((sum, day) => ({ sessions: sum.sessions + day.sessions, minutes: sum.minutes + day.minutes }), { sessions: 0, minutes: 0 });
  const summary = document.getElementById("progressSummary");
  summary.replaceChildren();
  for (const [value, label] of [[totals.sessions, "SESSIONS COMPLETED"], [totals.minutes, "FOCUS MINUTES"], [Object.keys(progress).length, "ACTIVE DAYS"]]) {
    const card = document.createElement("div");
    const number = document.createElement("strong");
    number.textContent = value;
    const caption = document.createElement("span");
    caption.textContent = label;
    card.append(number, caption);
    summary.append(card);
  }
  const grid = document.getElementById("heatmap");
  const cells = [];
  for (let offset = 363; offset >= 0; offset--) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const key = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
    const day = progress[key] || { sessions: 0, minutes: 0 };
    const cell = document.createElement("div");
    cell.dataset.level = day.minutes === 0 ? 0 : day.minutes < 30 ? 1 : day.minutes < 60 ? 2 : day.minutes < 120 ? 3 : 4;
    cell.title = `${date.toLocaleDateString()}: ${day.sessions} sessions, ${day.minutes} minutes`;
    cell.setAttribute("aria-label", cell.title);
    cell.setAttribute("role", "listitem");
    cells.push(cell);
  }
  grid.replaceChildren(...cells);
}

document.addEventListener("DOMContentLoaded", () => {
  const reason = document.getElementById("reason");
  const updateReasonCount = () => {
    const length = reason.value.trim().length;
    document.getElementById("reasonCount").textContent = `${length} / 100 characters minimum (500 maximum)`;
    document.getElementById("requestUnlock").disabled = length < 100;
  };
  reason.addEventListener("input", updateReasonCount);
  updateReasonCount();
  document.getElementById("unlockForm").onsubmit = async event => {
    event.preventDefault();
    try { await send({ type: "requestUnlock", reason: document.getElementById("reason").value }); await render(); }
    catch (error) { document.getElementById("status").textContent = error.message; }
  };
  for (const [id, type] of [["confirmUnlock", "confirmUnlock"], ["cancelUnlock", "cancelUnlock"]]) {
    document.getElementById(id).onclick = async () => {
      try { await send({ type }); await render(); }
      catch (error) { document.getElementById("status").textContent = error.message; }
    };
  }
  document.getElementById("addForm").onsubmit = async event => {
    event.preventDefault();
    const input = document.getElementById("domain");
    try {
      await send({ type: "add", domain: Domains.normalizeDomain(input.value) });
      input.value = "";
      document.getElementById("status").textContent = "Website blocked.";
    } catch (error) { document.getElementById("status").textContent = error.message; }
  };
  document.getElementById("focusForm").onsubmit = async event => {
    event.preventDefault();
    try {
      await send({ type: "focus", minutes: document.getElementById("minutes").value });
      document.getElementById("status").textContent = "Focus session started.";
    } catch (error) { document.getElementById("status").textContent = error.message; }
  };
  render().catch(error => { document.getElementById("status").textContent = error.message; });
  setInterval(() => render().catch(error => { document.getElementById("status").textContent = error.message; }), 1000);
});
chrome.storage.onChanged.addListener(() => render().catch(error => { document.getElementById("status").textContent = error.message; }));
