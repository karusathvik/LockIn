function updateRules(domains) {
  const rules = domains.map((domain, index) => ({
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

chrome.storage.local.get(["blocked"], (result) => {
  updateRules(result.blocked || []);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.blocked) {
    updateRules(changes.blocked.newValue || []);
  }
});