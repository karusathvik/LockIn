importScripts("domains.js");

let pending = Promise.resolve();

async function enforceTab(tabId, url) {
  let host;
  try { host = Domains.normalizeDomain(url); } catch { return; }
  const { blocked = [] } = await chrome.storage.local.get("blocked");
  if (Domains.clean(blocked).some(domain => Domains.matches(host, domain))) {
    await chrome.tabs.update(tabId, { url: chrome.runtime.getURL("blocked.html") }).catch(() => {});
  }
}

async function refreshRules() {
  const { blocked = [] } = await chrome.storage.local.get("blocked");
  const domains = Domains.clean(blocked);
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

function queueRefresh() {
  pending = pending.catch(() => {}).then(refreshRules);
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
  if (!["add", "remove", "focus"].includes(message.type)) return;
  pending = pending.catch(() => {}).then(async () => {
    const { focusUntil = 0 } = await chrome.storage.local.get("focusUntil");
    if (message.type === "focus") {
      if (focusUntil > Date.now()) throw new Error("Your focus session is already running.");
      const minutes = Number(message.minutes);
      if (![15, 30, 60, 120].includes(minutes)) throw new Error("Choose a supported session duration.");
      const { blocked = [] } = await chrome.storage.local.get("blocked");
      if (!Domains.clean(blocked).length) throw new Error("Block at least one website first.");
      await chrome.storage.local.set({ focusUntil: Date.now() + minutes * 60000 });
      return;
    }
    if (message.type === "remove" && focusUntil > Date.now()) throw new Error("Blocked websites cannot be removed until your focus session ends.");
    const domain = Domains.normalizeDomain(message.domain);
    const { blocked = [] } = await chrome.storage.local.get("blocked");
    await chrome.storage.local.set({
      blocked: message.type === "add" ? Domains.clean([...blocked, domain]) : Domains.clean(blocked).filter(item => item !== domain)
    });
    await refreshRules();
  });
  pending.then(() => respond({ ok: true }), error => respond({ error: error.message }));
  return true;
});
