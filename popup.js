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
        if (!result) throw new Error("Reload Locked In at chrome://extensions, then reopen this popup and try again.");
        if (result?.error) throw new Error(result.error);
        status.textContent = "Website blocked.";
      } catch (error) {
        status.textContent = /Receiving end does not exist|Could not establish connection|Extension context invalidated/i.test(error.message) ? "Reload Locked In at chrome://extensions, then reopen this popup and try again. If it still fails, check the extension’s Errors panel." : error.message;
        button.disabled = false;
      }
    };
  } catch {
    document.getElementById("site").textContent = "Open a website to block it, or add its domain in settings.";
    button.disabled = true;
  }
});
