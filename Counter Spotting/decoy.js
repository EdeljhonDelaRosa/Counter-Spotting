// decoy module loaded

export const DecoySystem = (() => {
  let decoyEnabled = true;
  let decoyRate = 0.25;
  let decoyHosts = [
    "https://example.com",
    "https://httpbin.org",
    "https://developer.mozilla.org",
    "https://www.rfc-editor.org"
  ];

  const DEC0Y_PATHS = [
    "/.well-known/security.txt",
    "/robots.txt",
    "/favicon.ico",
    "/manifest.json",
    "/sitemap.xml"
  ];

  function randomPath() {
    const base = DEC0Y_PATHS[Math.floor(Math.random() * DEC0Y_PATHS.length)];
    const salt = Math.random().toString(36).substring(2, 6);
    return `${base}?n=${salt}`;
  }

  function randomHost() {
    return decoyHosts[Math.floor(Math.random() * decoyHosts.length)];
  }

  async function sendDecoy(originalUrl = "https://example.com/") {
    if (!decoyEnabled) return;
    if (Math.random() > decoyRate) return;

    try {
      const u = new URL(originalUrl);
      let decoyUrl;
      if (Math.random() < 0.5) {
        decoyUrl = u.origin + randomPath();
      } else {
        decoyUrl = randomHost() + randomPath();
      }

      // fire-and-forget
      fetch(decoyUrl, {
        method: "GET",
        mode: "no-cors",
        credentials: "omit",
        cache: "no-store"
      }).catch(() => {});
      } catch (err) {
      try {
        const m = err && err.message ? err.message : String(err);
        if (!/Extension context invalidated|message port closed|Receiving end does not exist/i.test(m)) {}
      } catch (e) {}
    }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "set-decoy-config") {
      if (typeof msg.enabled === "boolean") decoyEnabled = msg.enabled;
      if (typeof msg.rate === "number") decoyRate = Math.max(0, Math.min(1, msg.rate));
      if (Array.isArray(msg.hosts)) decoyHosts = msg.hosts.slice();
      sendResponse({ success: true });
    }
  });

  return {
    sendDecoy,
    _config: () => ({ decoyEnabled, decoyRate, decoyHosts }) // debug helper
  };
})();
