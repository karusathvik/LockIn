(function (root) {
  function normalizeDomain(input) {
    const value = String(input || "").trim();
    const url = new URL(value.includes("://") ? value : "https://" + value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Enter a website domain or HTTP(S) URL.");
    const host = url.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
    if (!host.includes(".") || !/^[a-z0-9.-]+$/.test(host) || host.split(".").some(part => !part || part.startsWith("-") || part.endsWith("-"))) throw new Error("Enter a valid domain, such as monkeytype.com.");
    return host;
  }
  function matches(host, domain) {
    return host === domain || host.endsWith("." + domain);
  }
  function clean(domains) {
    return [...new Set((domains || []).flatMap(value => {
      try { return [normalizeDomain(value)]; } catch { return []; }
    }))].sort();
  }
  root.Domains = { normalizeDomain, matches, clean };
})(globalThis);
