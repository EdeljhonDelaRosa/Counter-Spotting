// ================================
// Counter-Spotting: Request Sanitizer
// Removes political identifiers, PII, fingerprinting,
// and normalizes outbound metadata.
// ================================

// request sanitizer module

const RequestSanitizer = (() => {

    // Parameters commonly used for behavioral/political tracking
    const STRIP_PARAMS = [
        "fbclid", "gclid", "dclid",
        "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
        "ref", "ref_url",
        "session", "sessionid", "sid",
        "userid", "user_id",
        "tracking_id", "track", "fingerprint",
    ];

    // Headers that should never be forwarded
    const STRIP_HEADERS = [
        "x-facebook-trace-id",
        "x-client-data",
        "x-msedge-clientid",
        "x-b3-traceid",
        "x-amzn-trace-id",
        "cookie",
        "authorization",
        "x-auth-token"
    ];

    // Keyword patterns associated with political profiling
    const POLITICAL_PATTERNS = [
        /election/i,
        /candidate/i,
        /opposition/i,
        /party/i,
        /vote/i,
        /campaign/i,
        /leftwing|rightwing/i
    ];

    // Very light, stable noise to break linkability
    function noiseSalt() {
        return Math.random().toString(36).slice(2, 8);
    }

    // -------------------------------
    // URL Sanitization
    // -------------------------------
    function sanitizeUrl(rawUrl) {
        try {
            const url = new URL(rawUrl);

            // Strip known tracking or political parameters
            STRIP_PARAMS.forEach(p => url.searchParams.delete(p));

            // Replace referrer-like params with safe placeholder
            if (url.searchParams.has("ref")) {
                url.searchParams.set("ref", "sanitized");
            }

            // Add noise seed
            url.searchParams.set("rseed", noiseSalt());

            return url.toString();
        } catch (err) {
            try {
                const m = String(rawUrl || '');
                if (!/Extension context invalidated|message port closed|Receiving end does not exist/i.test(m)) {}
            } catch (e) {}
            return rawUrl; // fallback
        }
    }

    // -------------------------------
    // Header Sanitization
    // -------------------------------
    function sanitizeHeaders(headersObj) {
        const clean = {};

        for (const [key, value] of Object.entries(headersObj || {})) {
            const lower = key.toLowerCase();

            // Remove fingerprinting or auth headers
            if (STRIP_HEADERS.includes(lower)) continue;

            // Remove obviously political metadata markers
            if (POLITICAL_PATTERNS.some(rx => rx.test(lower))) continue;

            clean[key] = value;
        }

        return clean;
    }

    // -------------------------------
    // Body Sanitization (if structured)
    // -------------------------------
    function sanitizeBody(body) {
        if (!body) return body;

        try {
            const parsed = JSON.parse(body);

            // Strip political keys
            for (const key of Object.keys(parsed)) {
                if (POLITICAL_PATTERNS.some(rx => rx.test(key))) {
                    delete parsed[key];
                }
            }

            return JSON.stringify(parsed);

        } catch (_) {
            // If body isn't JSON → return untouched
            return body;
        }
    }

    // -------------------------------
    // Full Sanitization Handler
    // (used by background.js)
    // -------------------------------
    function sanitizeRequest({ url, method, headers, body }) {
        const safeUrl = sanitizeUrl(url);
        const safeHeaders = sanitizeHeaders(headers);
        const safeBody = sanitizeBody(body);

        return {
            url: safeUrl,
            method,
            headers: safeHeaders,
            body: safeBody
        };
    }

    // Allow background.js to call this easily
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.type === "sanitize-request") {
            const clean = sanitizeRequest(msg.data);
            sendResponse({ cleaned: clean });
        }
    });

    return {
        sanitizeRequest
    };

})();
