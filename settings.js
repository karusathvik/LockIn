function renderDomains(domains) {
    const list = document.getElementById("domainList");
    list.innerHTML = "";
    domains.forEach(domain => {
      const li = document.createElement("li");
      li.textContent = domain;
      const del = document.createElement("button");
      del.textContent = "Remove";
      del.onclick = () => {
        const updated = domains.filter(d => d !== domain);
        chrome.storage.local.set({ blocked: updated });
      };
      li.appendChild(del);
      list.appendChild(li);
    });
  }
  
  function renderKeywords(keywords) {
    const list = document.getElementById("keywordList");
    list.innerHTML = "";
    keywords.forEach(keyword => {
      const li = document.createElement("li");
      li.textContent = keyword;
      const del = document.createElement("button");
      del.textContent = "Remove";
      del.onclick = () => {
        const updated = keywords.filter(k => k !== keyword);
        chrome.storage.local.set({ keywords: updated });
      };
      li.appendChild(del);
      list.appendChild(li);
    });
  }
  
  document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("domainInput");
    const addBtn = document.getElementById("addDomain");
  
    chrome.storage.local.get(["blocked"], (result) => {
      const blocked = result.blocked || [];
      renderDomains(blocked);
    });
  
    addBtn.onclick = () => {
      const domain = input.value.trim().replace(/^www\./, '').toLowerCase();
      if (domain) {
        chrome.storage.local.get(["blocked"], (result) => {
          const blocked = result.blocked || [];
          if (!blocked.includes(domain)) {
            blocked.push(domain);
            chrome.storage.local.set({ blocked });
            input.value = "";
          }
        });
      }
    };
  
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local") {
        if (changes.blocked) renderDomains(changes.blocked.newValue);
        if (changes.keywords) renderKeywords(changes.keywords.newValue);
      }
    });
  
    const keywordInput = document.getElementById("keywordInput");
    const addKeywordBtn = document.getElementById("addKeyword");
  
    chrome.storage.local.get(["keywords"], (result) => {
      const keywords = result.keywords || [];
      renderKeywords(keywords);
    });
  
    addKeywordBtn.onclick = () => {
      const keyword = keywordInput.value.trim().toLowerCase();
      if (keyword) {
        chrome.storage.local.get(["keywords"], (result) => {
          const keywords = result.keywords || [];
          if (!keywords.includes(keyword)) {
            keywords.push(keyword);
            chrome.storage.local.set({ keywords });
            keywordInput.value = "";
          }
        });
      }
    };
  });