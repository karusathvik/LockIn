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
  assert.equal(app.rules().length, app.context.Domains.permanent.length + 2);
  const hosts = app.rules().flatMap(rule => Array.from(rule.condition.requestDomains));
  assert.ok(hosts.includes("monkeytype.com"));
  assert.ok(hosts.includes("mail.google.com"));
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
  assert.equal(app.rules().length, app.context.Domains.permanent.length);
  await Promise.all(["monkeytype.com", "mail.google.com"].map(domain => app.send({ type: "add", domain })));
  assert.equal(app.data.blocked.length, 2);
  assert.match((await app.send({ type: "focus", minutes: -1 })).error, /supported/);
});
test("early unlocking requires a reason, a persisted wait, and explicit confirmation", async () => {
  const app = setup({ blocked: ["monkeytype.com"] });
  await app.idle();
  await app.send({ type: "focus", minutes: 30 });
  assert.match((await app.send({ type: "requestUnlock", reason: "short" })).error, /reason/);
  assert.equal((await app.send({ type: "requestUnlock", reason: "x".repeat(100) })).ok, true);
  assert.equal((await app.send({ type: "add", domain: "mail.google.com" })).ok, true);
  assert.match((await app.send({ type: "remove", domain: "mail.google.com" })).error, /cannot be removed/);
  const readyAt = app.data.unlockRequest.readyAt;
  assert.match((await app.send({ type: "requestUnlock", reason: "A second reason to reset the timer" })).error, /already pending/);
  assert.equal(app.data.unlockRequest.readyAt, readyAt);
  const restarted = setup(app.data);
  await restarted.idle();
  assert.match((await restarted.send({ type: "confirmUnlock" })).error, /countdown/);
  vm.runInContext(`Date.now = () => ${readyAt + 1}`, restarted.context);
  assert.equal((await restarted.send({ type: "confirmUnlock" })).ok, true);
  assert.equal(restarted.data.focusUntil, 0);
  assert.equal(restarted.data.focusSession, null);
  assert.equal(restarted.data.progress, undefined);
  assert.deepEqual(Array.from(restarted.data.blocked).sort(), ["mail.google.com", "monkeytype.com"]);
});
test("cancelled unlock requests cannot end a session", async () => {
  const app = setup({ blocked: ["monkeytype.com"] });
  await app.idle();
  await app.send({ type: "focus", minutes: 15 });
  await app.send({ type: "requestUnlock", reason: "x".repeat(100) });
  await app.send({ type: "cancelUnlock" });
  assert.equal(app.data.unlockRequest, null);
  assert.match((await app.send({ type: "confirmUnlock" })).error, /No active/);
  assert.ok(app.data.focusUntil > Date.now());
});
test("completed sessions are credited once across restart and concurrent status requests", async () => {
  const app = setup({ blocked: ["monkeytype.com"] });
  await app.idle();
  await app.send({ type: "focus", minutes: 15 });
  const day = app.data.focusSession.day;
  const end = app.data.focusUntil;
  vm.runInContext(`Date.now = () => ${end + 1}`, app.context);
  await Promise.all([app.send({ type: "status" }), app.send({ type: "status" })]);
  assert.equal(app.data.progress[day].sessions, 1);
  assert.equal(app.data.progress[day].minutes, 15);
  const restarted = setup(app.data);
  await restarted.idle();
  await restarted.send({ type: "status" });
  assert.equal(restarted.data.progress[day].sessions, 1);
  const offline = setup({ blocked: ["monkeytype.com"], focusUntil: Date.now() - 1, focusSession: { day, minutes: 30 } });
  await offline.idle();
  assert.equal(offline.data.progress[day].minutes, 30);
});

test("unlock reasons require 100 trimmed characters and permit at most 500", async () => {
  const app = setup({ blocked: ["monkeytype.com"] });
  await app.idle();
  await app.send({ type: "focus", minutes: 15 });
  for (const reason of ["x".repeat(99), " " + "x".repeat(99) + " ", "x".repeat(501)]) {
    assert.match((await app.send({ type: "requestUnlock", reason })).error, /100 and 500/);
    assert.equal(app.data.unlockRequest, null);
  }
  assert.equal((await app.send({ type: "requestUnlock", reason: "x".repeat(500) })).ok, true);
});
