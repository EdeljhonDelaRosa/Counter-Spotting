
import { DecoySystem } from './decoy.js';
import { ProxyEngine } from './proxy.js';

let extensionEnabled = false;
let onboardingTabId = null;

const DEFAULT_STATE = {
    proxyUrl: "",
    enableProxy: false,
    enableDecoys: false,
    decoyInterval: 3,
    decoyHost: "",
    extensionEnabled: false,
    showReadme: true
};

async function getState() {
    return new Promise(res => {
        chrome.storage.local.get(DEFAULT_STATE, data => res(data));
    });
}

async function setState(newState) {
    return new Promise(res => {
        chrome.storage.local.set(newState, () => res(true));
    });
}

chrome.runtime.onStartup.addListener(() => {
    getState().then(state => {
        extensionEnabled = !!state.extensionEnabled;
    }).catch(() => {
        extensionEnabled = false;
    });
});

chrome.runtime.onInstalled.addListener(() => {
    extensionEnabled = false;
    try {
        chrome.storage.local.set({ extensionEnabled: false, showReadme: true, enableDecoys: false, enableProxy: false, decoyInterval: DEFAULT_STATE.decoyInterval });
        chrome.alarms.create("scheduledDecoys", {
            periodInMinutes: DEFAULT_STATE.decoyInterval
        });
    } catch (err) {
        try {
            const m = err && err.message ? err.message : String(err);
            if (!/Extension context invalidated|message port closed|Receiving end does not exist/i.test(m)) {}
        } catch (e) {}
    }
});

chrome.alarms.onAlarm.addListener(async alarm => {
    if (!extensionEnabled || alarm.name !== "scheduledDecoys") return;
    const state = await getState();
    if (!state.enableDecoys || !state.extensionEnabled) return;

    try {
        await DecoySystem.sendDecoy(state.decoyHost || "https://example.com/");
    } catch (err) {
        try {
            const m = err && err.message ? err.message : String(err);
            if (!/Extension context invalidated|message port closed|Receiving end does not exist/i.test(m)) {}
        } catch (e) {}
    }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    try {
        if (msg && msg.type === "onboarding-done") {
            try {
                const enable = msg.enable === true;
                const showReadme = msg.showReadme !== undefined ? !!msg.showReadme : true;
                extensionEnabled = !!enable;
                chrome.storage.local.set({ extensionEnabled: extensionEnabled, showReadme: showReadme });
            } catch (e) {}
            try {
                if (onboardingTabId) {
                    chrome.tabs.remove(onboardingTabId, () => { onboardingTabId = null; });
                }
            } catch (e) {}
            try { sendResponse({ ok: true }); } catch (e) {}
            return false;
        }

        if (msg && msg.type === "settings-changed" && msg.payload) {
            try {
                getState().then(existing => {
                    try {
                        const newState = { ...(existing || {}), ...msg.payload };
                        chrome.storage.local.set(newState, () => {
                            try { extensionEnabled = !!newState.extensionEnabled; } catch (e) {}
                            try {
                                chrome.tabs.query({}, (tabs) => {
                                    for (const t of tabs || []) {
                                        try { chrome.tabs.sendMessage(t.id, { type: 'settings-changed', payload: newState }, (resp) => { try { if (chrome.runtime && chrome.runtime.lastError) return; } catch (e) {} }); } catch (e) {}
                                    }
                                });
                            } catch (e) {}
                        });
                    } catch (e) {}
                }).catch(() => {});
            } catch (e) {}
            try { sendResponse({ ok: true }); } catch (e) {}
            return false;
        }

        if (!extensionEnabled) {
            try {
                sendResponse({ ok: false, error: "Extension disabled" });
            } catch (e) {}
            return false;
        }

        switch (msg.type) {
            case "update-settings":
                sendResponse({ ok: true });
                getState().then(currentState => {
                    const newState = { ...currentState, ...msg.payload };
                    chrome.storage.local.set(newState, () => {
                        try {
                            chrome.tabs.query({}, (tabs) => {
                                for (const t of tabs || []) {
                                    try {
                                        chrome.tabs.sendMessage(t.id, { type: 'settings-changed', payload: newState }, (resp) => { try { if (chrome.runtime && chrome.runtime.lastError) return; } catch (e) {} });
                                    } catch (e) {}
                                }
                            });
                        } catch (e) {}
                    });
                    extensionEnabled = msg.payload.extensionEnabled !== false;
                }).catch(() => {});
                return false;

            case "get-settings":
                getState().then(state => {
                    try {
                        sendResponse(state || {});
                    } catch (e) {}
                }).catch(() => {
                    try {
                        sendResponse({});
                    } catch (e) {}
                });
                return true;

            case "sanitize-and-proxy":
                handleSanitizeAndProxy(msg).then(resp => {
                    try {
                        sendResponse(resp);
                    } catch (e) {}
                }).catch(() => {
                    try {
                        sendResponse({ useProxy: false, payload: {} });
                    } catch (e) {}
                });
                return true;

            case "decoy-from-content":
                sendResponse({ ok: true });
                DecoySystem.sendDecoy(msg.url).catch(err => {
                    if (!err.message?.includes("Extension context")) {}
                });
                return false;

            case "extension-enabled":
                extensionEnabled = msg.enabled === true;
                sendResponse({ ok: true });
                return false;

            default:
                sendResponse({ ok: false, error: "Unknown message type" });
                return false;
        }
    } catch (err) {
        try {
            sendResponse({ ok: false });
        } catch (e) {}
    }

    return false;
});

async function handleSanitizeAndProxy(msg) {
    try {
        if (!extensionEnabled) {
            return {
                useProxy: false,
                payload: {
                    url: msg.url || "",
                    method: msg.method || "GET",
                    headers: {},
                    body: null
                }
            };
        }

        const state = await getState();
        if (!state.extensionEnabled) {
            return {
                useProxy: false,
                payload: {
                    url: msg.url || "",
                    method: msg.method || "GET",
                    headers: {},
                    body: null
                }
            };
        }

        const sanitizedUrl = sanitizeUrl(msg.url || "");
        const cleanHeaders = sanitizeHeaders(msg.headers);

        if (!state.enableProxy || !state.proxyUrl) {
            return {
                useProxy: false,
                payload: {
                    url: sanitizedUrl,
                    method: msg.method || "GET",
                    headers: cleanHeaders,
                    body: msg.body || null
                }
            };
        }

        return {
            useProxy: true,
            proxyUrl: state.proxyUrl,
            payload: {
                url: sanitizedUrl,
                method: msg.method || "GET",
                headers: cleanHeaders,
                body: msg.body || null
            }
        };
    } catch (err) {
        return {
            useProxy: false,
            payload: {
                url: msg.url || "",
                method: msg.method || "GET",
                headers: {},
                body: null
            }
        };
    }
}

function sanitizeUrl(rawUrl) {
    try {
        const u = new URL(rawUrl);
        const BAD_PARAMS = [
            "utm_source", "utm_medium", "utm_campaign",
            "utm_term", "utm_content", "fbclid",
            "gclid", "igshid"
        ];
        BAD_PARAMS.forEach(p => u.searchParams.delete(p));
        return u.toString();
    } catch {
        return rawUrl;
    }
}

function sanitizeHeaders(headers = {}) {
    const safe = {};
    for (const k in headers) {
        if (!["cookie", "authorization", "referer", "origin"].includes(k.toLowerCase())) {
            safe[k] = headers[k];
        }
    }
    return safe;
}


