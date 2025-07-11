function getDomain(url) {
  const u = new URL(url);
  return u.hostname.replace(/^www\./, '');
}

document.addEventListener("DOMContentLoaded", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const currentDomain = getDomain(currentTab.url);
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

    // Inject script to get metadata and analyze page
    chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: () => {
        try {
          const title = document.title;
          const metaDescription = document.querySelector("meta[name='description']")?.content || "";
          const ogDescription = document.querySelector("meta[property='og:description']")?.content || "";
          const ogTitle = document.querySelector("meta[property='og:title']")?.content || "";
          const url = window.location.href;

          return { title, metaDescription, ogDescription, ogTitle, url };
        } catch (e) {
          return { error: true };
        }
      }
    }, async (results) => {
      const metadata = results[0].result;
      if (!metadata || metadata.error) {
        console.warn("Could not fetch metadata");
        return;
      }

      const domain = new URL(metadata.url).hostname.replace(/^www\./, "");
      const SAFE_DOMAINS = ["google.com", "bing.com", "duckduckgo.com", "yahoo.com", "chatgpt.com"];

      if (SAFE_DOMAINS.includes(domain)) return;

      chrome.storage.local.get(["keywords", "blocked", "allowed"], async (res) => {
        const keywords = res.keywords || [];
        let blocked = res.blocked || [];
        const allowed = res.allowed || [];

        if (blocked.includes(domain) || allowed.some(allow => domain.endsWith(allow))) return;
        if (keywords.length === 0) return;

        const promptText = `Does the following website fall under one of these categories [${keywords.join(", ")}]:` +
          `Title: ${metadata.title}` +
          `which is about: ${metadata.metaDescription}` +
          `and its url being: ${metadata.url}. Reply only with yes or no and carefully think this website along with its information is about any of the mentioned categories. Remember only a yes or no reply.`;

        const session = await LanguageModel.create();
        const result = await session.prompt(promptText);
        console.log("Prompt API response:", result);

        if (result.trim().toLowerCase() === "yes") {
          if (!blocked.includes(domain)) {
            blocked.push(domain);
            chrome.storage.local.set({ blocked });
          } else {
            // Still trigger update in UI
            chrome.storage.local.set({ blocked });
          }
          chrome.tabs.reload(currentTab.id);
        }
      });
    });
  });
});
