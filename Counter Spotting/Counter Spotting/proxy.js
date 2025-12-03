// proxy.js
// Proxy rewriting engine — exported as ES module
// proxy module

export const ProxyEngine = (() => {

  const relayNodes = [
    "https://relay1.example-proxy.net/",
    "https://relay2.example-proxy.net/",
    "https://relay3.example-proxy.net/"
  ];

  function chooseRelay() {
    return relayNodes[Math.floor(Math.random() * relayNodes.length)];
  }

  function addNoise(value) {
    const noise = Math.floor(Math.random() * 10000);
    return `${value}-${noise}`;
  }

  function rewriteRequest(url) {
    try {
      const u = new URL(url);
      const stripParams = [
        "user_id", "session", "tracking_id",
        "fingerprint", "fbclid", "gclid", "utm_source",
        "utm_campaign", "utm_medium"
      ];
      stripParams.forEach(p => u.searchParams.delete(p));
      if (u.searchParams.has("ref")) u.searchParams.set("ref", "sanitized");
      u.searchParams.set("rseed", addNoise(Date.now()));
      return u.toString();
    } catch (err) {
      try {
        const m = err && err.message ? err.message : String(err);
        if (!/Extension context invalidated|message port closed|Receiving end does not exist/i.test(m)) {}
      } catch (e) {}
      return url;
    }
  }

  function routeThroughProxy(url) {
    const relay = chooseRelay();
    return `${relay}?target=${encodeURIComponent(url)}`;
  }

  function processOutboundRequest(originalUrl, useProxy = false) {
    const rewritten = rewriteRequest(originalUrl);
    return useProxy ? routeThroughProxy(rewritten) : rewritten;
  }

  // optional message listener (background may call directly via import)
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "proxy-rewrite") {
      const output = processOutboundRequest(msg.url, !!msg.proxy);
      sendResponse({ rewrittenUrl: output });
    }
  });

  return {
    rewriteRequest,
    routeThroughProxy,
    processOutboundRequest
  };
})();
