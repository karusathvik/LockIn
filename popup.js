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
        const title = document.title;
        const metaDescription = document.querySelector("meta[name='description']")?.content || "";
        const ogDescription = document.querySelector("meta[property='og:description']")?.content || "";
        const ogTitle = document.querySelector("meta[property='og:title']")?.content || "";
        const url = window.location.href;

        return { title, metaDescription, ogDescription, ogTitle, url };
      }
    }, async (results) => {
      const metadata = results[0].result;
      const domain = new URL(metadata.url).hostname.replace(/^www\./, "");
      const SAFE_DOMAINS = ["google.com", "bing.com", "duckduckgo.com", "yahoo.com", "https://chatgpt.com"];

      if (SAFE_DOMAINS.includes(domain)) {
        return; // Never block search engines
      }

      chrome.storage.local.get(["keywords", "blocked"], async (res) => {
        const keywords = res.keywords || [];
        const blocked = res.blocked || [];

        if (blocked.includes(domain) || keywords.length === 0) return;

        const promptText = `I will soon give you the prompt but remeber reply only with **yes** or **no** in lowercase and do not explain. Does the following page fall under one of these categories [${keywords.join(", ")}], here is the page iformation below:\n` 
        +
          `Title: ${metadata.title}\n` +
          `OG Title: ${metadata.ogTitle}\n` +
          `Meta Description: ${metadata.metaDescription}\n` +
          `OG Description: ${metadata.ogDescription}\n` +
          `URL: ${metadata.url}\n` + 'Reply only with yes or no in lowercase. Do not reply with anything else so again reply with yes or no.\n';
        
        console.log(promptText); 
        const session = await LanguageModel.create();
        const result = await session.prompt(promptText);
        console.log("Prompt API response:", result);
        if (result == "yes" ) {
          blocked.push(domain);
          chrome.storage.local.set({ blocked });
        }


        
      });
    });
  });
});