const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
function setup(initial = {}, tabs = [{ id: 1, url: "https://monkeytype.com/" }, { id: 2, url: "https://mail.google.com/mail/u/0/" }]) {
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
    tabs: { query: async () => tabs, update: async (id, details) => redirects.push({ id, ...details }), onUpdated: event("updated") },
    webNavigation: { onBeforeNavigate: event("before"), onCommitted: event("committed"), onHistoryStateUpdated: event("history") },
    declarativeNetRequest: { getDynamicRules: async () => rules, updateDynamicRules: async value => { rules = value.addRules; } },
    runtime: { id: "test", getURL: path => "chrome-extension://test/" + path, onMessage: event("message"), onInstalled: event("installed"), onStartup: event("startup") }
  };
  const context = vm.createContext({ chrome, console, URL });
  context.importScripts = file => vm.runInContext(fs.readFileSync(file, "utf8"), context);
  vm.runInContext(fs.readFileSync("background.js", "utf8"), context);
  const idle = () => vm.runInContext("pending", context);
  const send = message => new Promise(resolve => listeners.message(message, { id: "test", url: "chrome-extension://test/settings.html" }, resolve));
  return { context, data, listeners, redirects, idle, send, rules: () => rules };
}
test("permanent rules are installed without preferences and survive a restart", async () => {
  const app = setup({}, [{ id: 50, url: "https://instagram.com/" }, { id: 51, url: "https://www.linkedin.com/jobs/" }]);
  await app.idle();
  assert.deepEqual(app.redirects.map(tab => tab.id), [50, 51]);
  assert.deepEqual(Array.from(app.rules(), rule => rule.condition.requestDomains[0]).sort(), ["facebook.com", "instagram.com", "linkedin.com"]);
  assert.ok(app.rules().every(rule => rule.action.redirect.extensionPath === "/blocked.html"));
  const restarted = setup({ blocked: [], allowed: ["instagram.com", "facebook.com", "linkedin.com"] });
  await restarted.idle();
  assert.equal(restarted.rules().length, 3);
});
test("permanent sites and subdomains cannot be removed through messages", async () => {
  const app = setup({ blocked: ["instagram.com", "mail.google.com"] });
  await app.idle();
  for (const domain of ["instagram.com", "www.instagram.com", "m.facebook.com", "linkedin.com", "https://www.linkedin.com/jobs/"]) {
    assert.match((await app.send({ type: "remove", domain })).error, /permanently blocked/);
  }
  assert.equal((await app.send({ type: "remove", domain: "mail.google.com" })).ok, true);
  assert.equal(app.rules().length, 3);
});
test("open tabs and client-side navigation are redirected only on matching host boundaries", async () => {
  const app = setup();
  await app.idle();
  app.redirects.length = 0;
  for (const [tabId, url] of [[10, "https://www.instagram.com/"], [11, "https://m.facebook.com/"], [12, "https://www.linkedin.com/jobs/"]]) {
    app.listeners.history({ tabId, frameId: 0, url });
  }
  app.listeners.updated(13, { url: "https://linkedin.com/feed/" }, {});
  app.listeners.history({ tabId: 14, frameId: 0, url: "https://notlinkedin.com/" });
  app.listeners.history({ tabId: 15, frameId: 0, url: "https://instagram.com.example.org/" });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(app.redirects.map(tab => tab.id).sort((a, b) => a - b), [10, 11, 12, 13]);
});
test("early unlock and natural session completion never remove permanent rules", async () => {
  const app = setup();
  await app.idle();
  assert.equal((await app.send({ type: "focus", minutes: 15 })).ok, true);
  assert.equal((await app.send({ type: "add", domain: "monkeytype.com" })).ok, true);
  await app.send({ type: "requestUnlock", reason: "x".repeat(100) });
  vm.runInContext(`Date.now = () => ${app.data.unlockRequest.readyAt + 1}`, app.context);
  assert.equal((await app.send({ type: "confirmUnlock" })).ok, true);
  assert.equal((await app.send({ type: "remove", domain: "monkeytype.com" })).ok, true);
  assert.match((await app.send({ type: "remove", domain: "instagram.com" })).error, /permanently blocked/);
  assert.equal(app.rules().length, 3);
  await app.send({ type: "focus", minutes: 15 });
  vm.runInContext(`Date.now = () => ${app.data.focusUntil + 1}`, app.context);
  await app.send({ type: "status" });
  assert.equal(app.data.focusUntil, 0);
  assert.match((await app.send({ type: "remove", domain: "linkedin.com" })).error, /permanently blocked/);
  assert.equal(app.rules().length, 3);
});
