async function send(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (response?.error) throw new Error(response.error);
}

async function render() {
  const { blocked = [] } = await chrome.storage.local.get("blocked");
  const list = document.getElementById("domains");
  list.replaceChildren();
  for (const domain of Domains.clean(blocked)) {
    const item = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = domain;
    const remove = document.createElement("button");
    remove.textContent = "Remove";
    remove.onclick = async () => {
      try { await send({ type: "remove", domain }); } catch (error) { document.getElementById("status").textContent = error.message; }
    };
    item.append(name, remove);
    list.append(item);
  }
}
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("addForm").onsubmit = async event => {
    event.preventDefault();
    const input = document.getElementById("domain");
    try {
      await send({ type: "add", domain: Domains.normalizeDomain(input.value) });
      input.value = "";
      document.getElementById("status").textContent = "Website blocked.";
    } catch (error) { document.getElementById("status").textContent = error.message; }
  };
  render().catch(console.error);
});
chrome.storage.onChanged.addListener(() => render().catch(console.error));
