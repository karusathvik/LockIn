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
  return { context, data, listeners, redirects, idle, send, rules: () => rules };
}
test("normalize pasted URLs and match only hostname boundaries", async () => {
  const app = setup();
  await app.idle();
  const { normalizeDomain, matches } = app.context.Domains;
  assert.equal(normalizeDomain(" HTTPS://WWW.MonkeyType.com/practice?q=1 "), "monkeytype.com");
  assert.equal(normalizeDomain("mail.google.com/mail/u/0"), "mail.google.com");
  assert.equal(matches("sub.monkeytype.com", "monkeytype.com"), true);
  assert.equal(matches("notmonkeytype.com", "monkeytype.com"), false);
  assert.equal(matches("mail.google.com.evil.com", "mail.google.com"), false);
  for (const input of ["chrome://settings", "hello", "https://user:pass@example.com", "bad domain.com"]) assert.throws(() => normalizeDomain(input));
});
test("rules and existing tabs enforce Monkeytype and Gmail despite legacy allow entries", async () => {
  const app = setup({ blocked: ["https://www.monkeytype.com/test", "mail.google.com"], allowed: ["google.com"] });
  await app.idle();
  assert.equal(app.rules().length, 2);
  assert.deepEqual(app.redirects.map(tab => tab.id).sort(), [1, 2]);
  assert.equal(app.rules()[0].action.redirect.extensionPath, "/blocked.html");
  assert.equal(app.rules()[0].condition.resourceTypes.includes("sub_frame"), true);
  await app.listeners.history({ frameId: 0, tabId: 3, url: "https://mail.google.com/mail/u/0/#inbox" });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.redirects.at(-1).id, 3);
});
test("focus sessions reject removal and cannot be shortened, but permit additions", async () => {
  const app = setup({ blocked: ["monkeytype.com"] });
  await app.idle();
  assert.equal((await app.send({ type: "focus", minutes: 30 })).ok, true);
  const deadline = app.data.focusUntil;
  assert.match((await app.send({ type: "remove", domain: "monkeytype.com" })).error, /cannot be removed/);
  assert.match((await app.send({ type: "focus", minutes: 15 })).error, /already running/);
  assert.equal(app.data.focusUntil, deadline);
  assert.equal((await app.send({ type: "add", domain: "mail.google.com" })).ok, true);
  const restarted = setup(app.data);
  await restarted.idle();
  assert.match((await restarted.send({ type: "remove", domain: "mail.google.com" })).error, /cannot be removed/);
  restarted.data.focusUntil = Date.now() - 1;
  assert.equal((await restarted.send({ type: "remove", domain: "mail.google.com" })).ok, true);
  assert.equal(restarted.data.blocked.includes("monkeytype.com"), true);
});
test("concurrent adds are serialized and invalid durations rejected", async () => {
  const app = setup();
  await app.idle();
  assert.match((await app.send({ type: "focus", minutes: 30 })).error, /at least one/);
  await Promise.all(["monkeytype.com", "mail.google.com"].map(domain => app.send({ type: "add", domain })));
  assert.equal(app.data.blocked.length, 2);
  assert.match((await app.send({ type: "focus", minutes: -1 })).error, /supported/);
});
