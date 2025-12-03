const ProxyRewriting = (() => {

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

    function rewriteUrl(safeUrl) {
        try {
            const url = new URL(safeUrl);

            const extraParams = ["sessionid", "track_id", "fingerprint"];
            extraParams.forEach(p => url.searchParams.delete(p));

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

    function routeThroughProxy(url) {
        const relay = chooseRelay();
        return `${relay}?target=${encodeURIComponent(url)}`;
    }

    function processRequest({ url, useProxy = false }) {
        const rewritten = rewriteUrl(url);
        return useProxy ? routeThroughProxy(rewritten) : rewritten;
    }

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

