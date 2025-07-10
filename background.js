function updateRules(domains, allowed) {
  const rules = domains
    .filter(domain => !allowed.includes(domain))
    .map((domain, index) => ({
      id: index + 1,
      priority: 1,
      action: {
        type: "redirect",
        redirect: {
          url: "https://www.google.com"
        }
      },
      condition: {
        urlFilter: domain,
        resourceTypes: ["main_frame"]
      }
    }));

  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: rules.map(r => r.id),
    addRules: rules
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