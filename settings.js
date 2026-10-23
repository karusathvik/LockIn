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
  
  function renderAllowed(allowed) {
    const list = document.getElementById("allowList");
    list.innerHTML = "";
    allowed.forEach(domain => {
      const li = document.createElement("li");
      li.textContent = domain;
      const del = document.createElement("button");
      del.textContent = "Remove";
      del.onclick = () => {
        const updated = allowed.filter(a => a !== domain);
        chrome.storage.local.set({ allowed: updated });
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
  
    const allowInput = document.getElementById("allowInput");
    const addAllowBtn = document.getElementById("addAllow");
  
    chrome.storage.local.get(["allowed"], (result) => {
      const allowed = result.allowed || [];
      renderAllowed(allowed);
    });
  
    addAllowBtn.onclick = () => {
      const domain = allowInput.value.trim().replace(/^www\./, '').toLowerCase();
      if (domain) {
        chrome.storage.local.get(["allowed"], (result) => {
          const allowed = result.allowed || [];
          if (!allowed.includes(domain)) {
            allowed.push(domain);
            chrome.storage.local.set({ allowed });
            allowInput.value = "";
          }
        });
      }
    };
  
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local") {
        if (changes.blocked) renderDomains(changes.blocked.newValue);
        if (changes.allowed) renderAllowed(changes.allowed.newValue);
      }
    });
  });