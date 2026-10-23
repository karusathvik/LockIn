importScripts("domains.js");

let pending = Promise.resolve();

async function enforceTab(tabId, url) {
  let host;
  try { host = Domains.normalizeDomain(url); } catch { return; }
  const { blocked = [] } = await chrome.storage.local.get("blocked");
  if (Domains.effective(blocked).some(domain => Domains.matches(host, domain))) {
    await chrome.tabs.update(tabId, { url: chrome.runtime.getURL("blocked.html") }).catch(() => {});
  }
}

async function refreshRules() {
  const { blocked = [] } = await chrome.storage.local.get("blocked");
  const domains = Domains.effective(blocked);
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map(rule => rule.id),
    addRules: domains.map((domain, index) => ({
      id: index + 1,
      priority: 1,
      action: { type: "redirect", redirect: { extensionPath: "/blocked.html" } },
      condition: { requestDomains: [domain], resourceTypes: ["main_frame", "sub_frame"] }
    }))
  });
  await Promise.all((await chrome.tabs.query({})).map(tab => enforceTab(tab.id, tab.pendingUrl || tab.url)));
}

async function settleSession() {
  const { focusUntil = 0, focusSession = null, progress = {} } = await chrome.storage.local.get(["focusUntil", "focusSession", "progress"]);
  if (!focusSession || focusUntil > Date.now()) return;
  const day = progress[focusSession.day] || { sessions: 0, minutes: 0 };
  progress[focusSession.day] = { sessions: day.sessions + 1, minutes: day.minutes + focusSession.minutes };
  await chrome.storage.local.set({ progress, focusSession: null, focusUntil: 0, unlockRequest: null });
}

function queueRefresh() {
  pending = pending.catch(() => {}).then(async () => { await settleSession(); await refreshRules(); });
  pending.catch(console.error);
  return pending;
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.blocked) queueRefresh();
});
chrome.tabs.onUpdated.addListener((id, change, tab) => {
  if (change.url || change.status === "complete") enforceTab(id, change.url || tab.url).catch(console.error);
});
for (const event of [chrome.webNavigation.onBeforeNavigate, chrome.webNavigation.onCommitted, chrome.webNavigation.onHistoryStateUpdated]) {
  event.addListener(details => {
    if (details.frameId === 0) enforceTab(details.tabId, details.url).catch(console.error);
  });
}
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.remove(["keywords", "allowed"]);
  queueRefresh();
});
chrome.runtime.onStartup.addListener(queueRefresh);
queueRefresh();

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(""))) return;
  if (!["add", "remove", "focus", "status", "requestUnlock", "cancelUnlock", "confirmUnlock", "requestRemoval", "cancelRemoval", "confirmRemoval"].includes(message.type)) return;
  pending = pending.catch(() => {}).then(async () => {
    await settleSession();
    const { focusUntil = 0 } = await chrome.storage.local.get("focusUntil");
    if (message.type === "status") return;
    if (message.type === "cancelUnlock") {
      await chrome.storage.local.set({ unlockRequest: null });
      return;
    }
    if (message.type === "requestUnlock") {
      if (focusUntil <= Date.now()) throw new Error("No active focus session.");
      const { unlockRequest = null } = await chrome.storage.local.get("unlockRequest");
      if (unlockRequest) throw new Error("An unlock request is already pending.");
      const reason = String(message.reason || "").trim();
      if (reason.length < 100 || reason.length > 500) throw new Error("Write a reason between 100 and 500 characters.");
      await chrome.storage.local.set({ unlockRequest: { reason, readyAt: Date.now() + 60000, focusUntil } });
      return;
    }
    if (message.type === "confirmUnlock") {
      const { unlockRequest = null } = await chrome.storage.local.get("unlockRequest");
      if (!unlockRequest || unlockRequest.focusUntil !== focusUntil || focusUntil <= Date.now()) throw new Error("No active unlock request.");
      if (Date.now() < unlockRequest.readyAt) throw new Error("Wait for the unlock countdown to finish.");
      await chrome.storage.local.set({ focusUntil: 0, focusSession: null, unlockRequest: null });
      return;
    }
    if (message.type === "focus") {
      if (focusUntil > Date.now()) throw new Error("Your focus session is already running.");
      const minutes = Number(message.minutes);
      if (![15, 30, 60, 120].includes(minutes)) throw new Error("Choose a supported session duration.");
      const { blocked = [] } = await chrome.storage.local.get("blocked");
      if (!Domains.effective(blocked).length) throw new Error("Block at least one website first.");
      const started = new Date();
      const day = [started.getFullYear(), String(started.getMonth() + 1).padStart(2, "0"), String(started.getDate()).padStart(2, "0")].join("-");
      await chrome.storage.local.set({ focusUntil: started.getTime() + minutes * 60000, focusSession: { day, minutes }, unlockRequest: null, removalRequests: {} });
      return;
    }
    if (["remove", "requestRemoval", "confirmRemoval"].includes(message.type) && focusUntil > Date.now()) throw new Error("Blocked websites cannot be removed until your focus session ends.");
    const domain = Domains.normalizeDomain(message.domain);
    if (Domains.isPermanent(domain)) throw new Error("This website is permanently blocked. Permanent blocks cannot be changed or unlocked in LockIn.");
    const { blocked = [], removalRequests = {} } = await chrome.storage.local.get(["blocked", "removalRequests"]);
    if (message.type === "remove") throw new Error("Pause before removing a website: write a reason, wait 30 seconds, then confirm in settings.");
    if (message.type === "cancelRemoval") {
      delete removalRequests[domain];
      await chrome.storage.local.set({ removalRequests });
      return;
    }
    if (message.type === "requestRemoval") {
      if (!Domains.clean(blocked).includes(domain)) throw new Error("This website is not on your additional block list.");
      const existing = removalRequests[domain];
      if (existing && Date.now() <= existing.expiresAt) throw new Error("A removal request is already pending for this website.");
      const reason = String(message.reason || "").trim();
      if (reason.length < 30 || reason.length > 500) throw new Error("Write a reason between 30 and 500 characters.");
      removalRequests[domain] = { reason, readyAt: Date.now() + 30000, expiresAt: Date.now() + 330000 };
      await chrome.storage.local.set({ removalRequests });
      return;
    }
    if (message.type === "confirmRemoval") {
      const request = removalRequests[domain];
      if (!request) throw new Error("Request removal and complete the pause first.");
      if (Date.now() < request.readyAt) throw new Error("Wait for the 30-second pause to finish.");
      if (Date.now() > request.expiresAt) throw new Error("This removal request expired. Start a fresh pause.");
      if (!Domains.clean(blocked).includes(domain)) throw new Error("This website is no longer on your additional block list.");
    }
    delete removalRequests[domain];
    await chrome.storage.local.set({
      blocked: message.type === "add" ? Domains.clean([...blocked, domain]) : Domains.clean(blocked).filter(item => item !== domain),
      removalRequests
    });
    await refreshRules();
  });
  pending.then(() => respond({ ok: true }), error => respond({ error: error.message }));
  return true;
});
