function updateRules(domains, allowed) {
  const rules = domains
    .filter(domain => !allowed.some(allow => domain.endsWith(allow)))
    .map((domain, index) => ({
      id: 1000 + index,
      priority: 1,
      action: {
        type: "redirect",
        redirect: {
          url: "https://www.google.com"
        }
      },
      condition: {
        urlFilter: `||${domain}^`,
        resourceTypes: ["main_frame"]
      }
    }));

  chrome.declarativeNetRequest.getDynamicRules(existing => {
    const oldIds = existing.map(rule => rule.id);
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: oldIds,
      addRules: rules
    });
  });
}

function refreshRules() {
  chrome.storage.local.get(["blocked", "allowed"], (result) => {
    const blocked = result.blocked || [];
    const allowed = result.allowed || [];
    updateRules(blocked, allowed);
  });
}

refreshRules();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.blocked || changes.allowed)) {
    refreshRules();
  }
});