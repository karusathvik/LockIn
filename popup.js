function getDomain(url) {
  const u = new URL(url);
  return u.hostname.replace(/^www\./, '');
}

document.addEventListener("DOMContentLoaded", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentDomain = getDomain(tabs[0].url);
    const toggle = document.getElementById("toggleBlock");

    chrome.storage.local.get(["blocked"], (result) => {
      const blocked = result.blocked || [];
      toggle.checked = blocked.includes(currentDomain);
    });

    toggle.addEventListener("change", () => {
      chrome.storage.local.get(["blocked"], (result) => {
        let blocked = result.blocked || [];

        if (toggle.checked && !blocked.includes(currentDomain)) {
          blocked.push(currentDomain);
        } else {
          blocked = blocked.filter(d => d !== currentDomain);
        }

        chrome.storage.local.set({ blocked });
      });
    });
  });
});
