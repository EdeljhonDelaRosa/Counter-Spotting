// ===========================================
// Counter-Spotting — Proxy Rewriting Module
// Rewrites outbound URLs and optionally routes them
// through privacy-preserving relay proxies.
// Works with sanitized requests from request_sanitizer.js
// ===========================================

// proxy rewriting module

const ProxyRewriting = (() => {

    // List of safe relay nodes for routing
    const relayNodes = [
        "https://relay1.example-proxy.net/",
        "https://relay2.example-proxy.net/",
        "https://relay3.example-proxy.net/"
    ];

    // Select a random relay
    function chooseRelay() {
        return relayNodes[Math.floor(Math.random() * relayNodes.length)];
    }

    // Adds lightweight random noise to URL to reduce linkability
    function addNoise(value) {
        const noise = Math.floor(Math.random() * 10000);
        return `${value}-${noise}`;
    }

    // ---------------------------------------
    // Rewrite a sanitized URL (optional)
    // - Strips residual tracking
    // - Adds lightweight randomization
    // ---------------------------------------
    function rewriteUrl(safeUrl) {
        try {
            const url = new URL(safeUrl);

            // Remove rarely used tracking params
            const extraParams = ["sessionid", "track_id", "fingerprint"];
            extraParams.forEach(p => url.searchParams.delete(p));

            // Add a random seed param to further reduce linkability
            url.searchParams.set("rseed", addNoise(Date.now()));

            return url.toString();
        } catch (err) {
                try {
                    const m = safeUrl || '';
                    if (!/Extension context invalidated|message port closed|Receiving end does not exist/i.test(m)) {}
                } catch (e) {}
            return safeUrl;
        }
    }

    // ---------------------------------------
    // Route through a relay proxy
    // ---------------------------------------
    function routeThroughProxy(url) {
        const relay = chooseRelay();
        return `${relay}?target=${encodeURIComponent(url)}`;
    }

    // ---------------------------------------
    // Full request processor
    // - rewrites sanitized URL
    // - optionally applies proxy
    // ---------------------------------------
    function processRequest({ url, useProxy = false }) {
        const rewritten = rewriteUrl(url);
        return useProxy ? routeThroughProxy(rewritten) : rewritten;
    }

    // ---------------------------------------
    // Allow background.js or other modules to call via messaging
    // ---------------------------------------
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.type === "proxy-rewrite") {
            const rewrittenUrl = processRequest({
                url: msg.url,
                useProxy: msg.proxy || false
            });
            sendResponse({ rewrittenUrl });
        }
    });

    return {
        rewriteUrl,
        routeThroughProxy,
        processRequest
    };

})();
