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
  
  document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("domainInput");
    const addBtn = document.getElementById("addDomain");
  
    chrome.storage.local.get(["blocked"], (result) => {
      const blocked = result.blocked || [];
      console.log("Blocked list from storage:", blocked); // Debug line
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
      if (area === "local" && changes.blocked) {
        renderDomains(changes.blocked.newValue);
      }
    });
  });
  