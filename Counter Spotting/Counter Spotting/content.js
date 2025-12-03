window.addEventListener("error", (event) => {
    try {
        const msg = (event && (event.message || (event.error && event.error.message))) || '';
        if (/Extension context invalidated|message port closed|Receiving end does not exist/i.test(msg)) {
            try { event.preventDefault(); } catch (e) {}
            return;
        }
    } catch (e) {}
}, true);

window.addEventListener("unhandledrejection", (event) => {
    try {
        const reason = event && (event.reason && (event.reason.message || String(event.reason))) || '';
        if (/Extension context invalidated|message port closed|Receiving end does not exist/i.test(reason)) {
            try { event.preventDefault(); } catch (e) {}
            return;
        }
    } catch (e) {}
    try { event.preventDefault(); } catch (e) {}
});

(function filterConsole() {
    try {
        const origErr = console.error.bind(console);
        const origWarn = console.warn.bind(console);
        const shouldFilter = (args) => {
            try {
                return args.some(a => /Extension context invalidated|message port closed|Receiving end does not exist/i.test(String(a)));
            } catch (e) { return false; }
        };
        console.error = function(...args) {
            if (shouldFilter(args)) return;
            return origErr(...args);
        };
        console.warn = function(...args) {
            if (shouldFilter(args)) return;
            return origWarn(...args);
        };
    } catch (e) {}
})();

const script = document.createElement("script");
script.src = chrome.runtime.getURL("injected.js");
script.type = "module";
(document.head || document.documentElement).appendChild(script);
script.remove();

function sendMessageToBackground(msg) {
    return new Promise((resolve) => {
        try {
            if (!chrome.runtime) {
                resolve(null);
                return;
            }

            chrome.runtime.sendMessage(msg, (response) => {
                try {
                    try {
                        if (chrome.runtime.lastError) {
                            const errorMsg = chrome.runtime.lastError.message || "";
                            if (!errorMsg.includes("Extension context")) {}
                            resolve(null);
                            return;
                        }
                    } catch (lastErrorCheck) {
                        resolve(null);
                        return;
                    }

                    resolve(response || null);
                } catch (callbackErr) {
                    resolve(null);
                }
            });
        } catch (err) {
            try {} catch (e) {}
            resolve(null);
        }
    });
}

let _cs_settings = {
    extensionEnabled: false,
    enableProxy: false,
    enableDecoys: false,
    proxyUrl: null,
    decoyRate: 0.25
};

function forwardSettingsToPage() {
    try {
        window.postMessage({ direction: 'to-page', type: 'settings-update', settings: _cs_settings }, '*');
    } catch (e) {}
}

try {
    chrome.storage.local.get(_cs_settings, (data) => {
        try {
            _cs_settings = Object.assign(_cs_settings, data || {});
            forwardSettingsToPage();
        } catch (e) {}
    });
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') return;
        let changed = false;
        for (const key in changes) {
            try {
                _cs_settings[key] = changes[key].newValue;
                changed = true;
            } catch (e) {}
        }
        if (changed) forwardSettingsToPage();
    });
} catch (e) {}

try {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        try {
            if (msg && msg.type === 'settings-changed' && msg.payload) {
                _cs_settings = Object.assign(_cs_settings, msg.payload || {});
                forwardSettingsToPage();
                try { sendResponse({ ok: true }); } catch (e) {}
                return false;
            }
        } catch (e) {}
    });
} catch (e) {}

window.addEventListener("message", (event) => {
    try {
        const msg = event.data;
        if (!msg || msg.direction !== "from-page") return;

        if (msg.type === "decoy-traffic") {
            try {
                sendMessageToBackground({ type: "decoy-from-content", url: msg.url || "https://example.com/" });
            } catch (e) {}
            return;
        }

        if (msg.type === "sanitize-and-proxy-request") {
            sendMessageToBackground({
                type: "sanitize-and-proxy",
                url: msg.url || "",
                method: msg.method || "GET",
                headers: msg.headers || {},
                body: msg.body || null,
                requestId: msg.requestId
            }).then(response => {
                if (!response) return;
                try {
                    window.postMessage({
                        direction: "to-page",
                        type: "sanitize-and-proxy-response",
                        requestId: msg.requestId,
                        response: response
                    }, "*");
                } catch (e) {}
            }).catch(err => {});
            return;
        }
    } catch (e) {}
});

// content script loaded
