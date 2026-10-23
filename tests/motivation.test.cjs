const { test } = require("node:test");
const assert = require("node:assert/strict");
require("../motivation.js");
const { parseQuotes, dailyPhrase, workURL } = globalThis.Motivation;
test("phrase imports accept text and JSON, trim and deduplicate", () => {
  assert.deepEqual(parseQuotes(" Keep going\n\nKeep going\nStart small "), ["Keep going", "Start small"]);
  assert.deepEqual(parseQuotes('["One", "Two"]'), ["One", "Two"]);
  for (const text of ["", '[1]', '{"quotes": []}', "x".repeat(281), Array.from({ length: 101 }, (_, i) => String(i)).join("\n"), "x".repeat(64001), '["broken"']) assert.throws(() => parseQuotes(text));
});
test("phrases remain stable within a local day with an offline default", () => {
  const morning = new Date(2026, 9, 17, 1);
  const evening = new Date(2026, 9, 17, 23);
  assert.equal(dailyPhrase(["A", "B"], morning), dailyPhrase(["A", "B"], evening));
  assert.ok(dailyPhrase([], morning).length);
  assert.equal(dailyPhrase(["A", "B"], new Date(2026, 9, 18)), dailyPhrase(["A", "B"], morning) === "A" ? "B" : "A");
});
test("return links allow only web URLs without embedded credentials", () => {
  assert.equal(workURL(""), "");
  assert.equal(workURL("https://example.com/work"), "https://example.com/work");
  for (const url of ["javascript:alert(1)", "data:text/html,test", "chrome://settings", "https://user:secret@example.com", "not a url"]) assert.throws(() => workURL(url));
});
