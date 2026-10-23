const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
function setup(initial = {}) {
  const data = { ...initial };
  const listeners = {};
  const redirects = [];
  let rules = [];
  const event = name => ({ addListener: fn => { listeners[name] = fn; } });
  const chrome = {
    storage: {
      local: {
        get: async keys => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, data[key]])),
        set: async values => Object.assign(data, values),
        remove: async keys => keys.forEach(key => delete data[key])
      },
      onChanged: event("changed")
    },
    tabs: { query: async () => [{ id: 1, url: "https://monkeytype.com/" }, { id: 2, url: "https://mail.google.com/mail/u/0/" }], update: async (id, details) => redirects.push({ id, ...details }), onUpdated: event("updated") },
    webNavigation: { onBeforeNavigate: event("before"), onCommitted: event("committed"), onHistoryStateUpdated: event("history") },
    declarativeNetRequest: { getDynamicRules: async () => rules, updateDynamicRules: async value => { rules = value.addRules; } },
    runtime: { id: "test", getURL: path => "chrome-extension://test/" + path, onMessage: event("message"), onInstalled: event("installed"), onStartup: event("startup") }
  };
  const context = vm.createContext({ chrome, console, URL });
  context.importScripts = file => vm.runInContext(fs.readFileSync(file, "utf8"), context);
  vm.runInContext(fs.readFileSync("background.js", "utf8"), context);
  const idle = () => vm.runInContext("pending", context);
  const send = message => new Promise(resolve => listeners.message(message, { id: "test", url: "chrome-extension://test/settings.html" }, resolve));
  const remove = async domain => {
    const requested = await send({ type: "requestRemoval", domain, reason: "I need this website for a specific work task." });
    if (requested.error) return requested;
    vm.runInContext(`Date.now = () => ${data.removalRequests[domain].readyAt + 1}`, context);
    return send({ type: "confirmRemoval", domain });
  };
  return { context, data, listeners, redirects, idle, send, remove, rules: () => rules };
}
test("ordinary removal requires a persisted pause and explicit confirmation", async () => {
  const app = setup({ blocked: ["monkeytype.com"] });
  await app.idle();
  assert.match((await app.send({ type: "remove", domain: "monkeytype.com" })).error, /Pause/);
  assert.match((await app.send({ type: "confirmRemoval", domain: "monkeytype.com" })).error, /Request removal/);
  assert.match((await app.send({ type: "requestRemoval", domain: "monkeytype.com", reason: "short" })).error, /30 and 500/);
  assert.equal((await app.send({ type: "requestRemoval", domain: "monkeytype.com", reason: "I need to practice typing for my work." })).ok, true);
  const request = app.data.removalRequests["monkeytype.com"];
  assert.match((await app.send({ type: "confirmRemoval", domain: "monkeytype.com" })).error, /30-second/);
  const restarted = setup(app.data);
  await restarted.idle();
  vm.runInContext(`Date.now = () => ${request.readyAt + 1}`, restarted.context);
  await restarted.send({ type: "status" });
  assert.ok(restarted.data.blocked.includes("monkeytype.com"));
  assert.equal((await restarted.send({ type: "confirmRemoval", domain: "monkeytype.com" })).ok, true);
  assert.equal(restarted.data.blocked.includes("monkeytype.com"), false);
});
test("cancellation and expiry keep the website blocked", async () => {
  const app = setup({ blocked: ["monkeytype.com"] });
  await app.idle();
  const request = () => app.send({ type: "requestRemoval", domain: "monkeytype.com", reason: "I need to practice typing for my work." });
  await request();
  await app.send({ type: "cancelRemoval", domain: "monkeytype.com" });
  assert.match((await app.send({ type: "confirmRemoval", domain: "monkeytype.com" })).error, /Request removal/);
  await request();
  vm.runInContext(`Date.now = () => ${app.data.removalRequests["monkeytype.com"].expiresAt + 1}`, app.context);
  assert.match((await app.send({ type: "confirmRemoval", domain: "monkeytype.com" })).error, /expired/);
  assert.ok(app.data.blocked.includes("monkeytype.com"));
  assert.equal((await request()).ok, true);
});
test("focus sessions clear removal requests and direct removal still cannot bypass permanent blocks", async () => {
  const app = setup({ blocked: ["monkeytype.com"] });
  await app.idle();
  await app.send({ type: "requestRemoval", domain: "monkeytype.com", reason: "I need to practice typing for my work." });
  await app.send({ type: "focus", minutes: 15 });
  assert.equal(Object.keys(app.data.removalRequests).length, 0);
  assert.match((await app.send({ type: "confirmRemoval", domain: "monkeytype.com" })).error, /session ends/);
  assert.equal((await app.send({ type: "add", domain: "example.org" })).ok, true);
  const fresh = setup();
  await fresh.idle();
  for (const type of ["remove", "requestRemoval", "confirmRemoval"]) {
    assert.match((await fresh.send({ type, domain: "instagram.com", reason: "x".repeat(100) })).error, /permanently blocked/);
  }
});
