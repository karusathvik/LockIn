document.addEventListener("DOMContentLoaded", async () => {
  const button = document.getElementById("block");
  const status = document.getElementById("status");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const domain = Domains.normalizeDomain(tab?.url);
    document.getElementById("site").textContent = domain;
    const { blocked = [] } = await chrome.storage.local.get("blocked");
    button.disabled = Domains.clean(blocked).some(item => Domains.matches(domain, item));
    if (button.disabled) status.textContent = "This website is already blocked.";
    button.onclick = async () => {
      button.disabled = true;
      try {
        const result = await chrome.runtime.sendMessage({ type: "add", domain });
        if (result?.error) throw new Error(result.error);
        status.textContent = "Website blocked.";
      } catch (error) {
        status.textContent = error.message;
        button.disabled = false;
      }
    };
  } catch {
    document.getElementById("site").textContent = "Open a website to block it, or add its domain in settings.";
    button.disabled = true;
  }
});
