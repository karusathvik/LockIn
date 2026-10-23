(function (root) {
  const defaults = [
    "Make the next step small enough to start now.",
    "You do not need to finish everything. Return to the next useful action.",
    "A distraction can wait. Give your next step two minutes.",
    "Progress is returning to the work, one choice at a time.",
    "Start with one sentence, one problem, or one test."
  ];
  function parseQuotes(text) {
    if (text.length > 64000) throw new Error("Use a phrase file smaller than 64 KB.");
    const trimmed = text.trim();
    const values = /^[\[{]/.test(trimmed) ? JSON.parse(trimmed) : trimmed.split(/\r?\n/);
    if (!Array.isArray(values) || values.some(value => typeof value !== "string")) throw new Error("Use one phrase per line or a JSON array of strings.");
    const phrases = [...new Set(values.map(value => value.trim()).filter(Boolean))];
    if (!phrases.length || phrases.length > 100 || phrases.some(value => value.length > 280)) throw new Error("Use 1–100 phrases, each no longer than 280 characters.");
    return phrases;
  }
  function dailyPhrase(phrases, date = new Date()) {
    const choices = Array.isArray(phrases) && phrases.length ? phrases : defaults;
    const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
    return choices[((day % choices.length) + choices.length) % choices.length];
  }
  function workURL(value) {
    if (!String(value || "").trim()) return "";
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Use an HTTP(S) work URL without login credentials.");
    return url.href;
  }
  root.Motivation = { defaults, parseQuotes, dailyPhrase, workURL };
})(globalThis);
