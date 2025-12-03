(function suppressExtensionErrors() {
  const FILTER_PATTERNS = [
    /Extension context invalidated/i,
    /message port closed/i,
    /Receiving end does not exist/i
  ];

  window.addEventListener('error', (event) => {
    try {
      const msg = (event && (event.message || (event.error && event.error.message))) || '';
      if (FILTER_PATTERNS.some(rx => rx.test(msg))) {
        try { event.preventDefault(); } catch (e) {}
        try { event.stopImmediatePropagation(); } catch (e) {}
      }
    } catch (e) {}
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    try {
      const reason = event && (event.reason && (event.reason.message || String(event.reason))) || '';
      if (FILTER_PATTERNS.some(rx => rx.test(reason))) {
        try { event.preventDefault(); } catch (e) {}
      }
    } catch (e) {}
  });
})();

function uuid() {
  return "req-" + Math.random().toString(36).slice(2) + Date.now();
}

function waitForProxyResponse(requestId, timeout = 5000) {
  return new Promise((resolve) => {
    let timer;

    function handler(event) {
      const msg = event.data;
      if (!msg) return;
      if (msg.direction !== "to-page") return;
      if (msg.requestId !== requestId) return;

      clearTimeout(timer);
      window.removeEventListener("message", handler);
      resolve(msg);
    }

    timer = setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve(null);
    }, timeout);

    window.addEventListener("message", handler);
  });
}

async function callProxy(proxyUrl, payload) {
  try {
    return await fetch(proxyUrl, {
      method: "POST",
      credentials: "omit",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    } catch (err) {
    try {
      const m = err && err.message ? err.message : String(err);
      if (!/Extension context invalidated|message port closed|Receiving end does not exist/i.test(m)) {}
    } catch (e) {}
    return null;
  }
}

let __page_settings = {
  extensionEnabled: false,
  enableProxy: false,
  enableDecoys: false,
  proxyUrl: null,
  decoyRate: 0.25
};

window.addEventListener("message", (event) => {
  try {
    const msg = event && event.data;
    if (!msg || msg.direction !== 'to-page') return;
    if (msg.type === 'settings-update' && msg.settings) {
      try {
        __page_settings = Object.assign(__page_settings, msg.settings);
        try { updateStatusBadge(); } catch (e) {}
      } catch (e) {}
    }
  } catch (e) {}
});

let __cs_badge = null;
function createStatusBadge() {
  try {
    if (__cs_badge) return __cs_badge;
    const d = document.createElement('div');
    d.id = 'counter-spotting-badge';
    d.style.position = 'fixed';
    d.style.right = '12px';
    d.style.bottom = '12px';
    d.style.zIndex = '2147483647';
    d.style.background = '#0B66FF'; /* primary blue */
    d.style.color = '#FFDF5A'; /* yellow accent */
    d.style.padding = '6px 10px';
    d.style.borderRadius = '6px';
    d.style.fontSize = '12px';
    d.style.fontFamily = 'Arial, sans-serif';
    d.style.boxShadow = '0 2px 8px rgba(11,102,255,0.16)';
    d.style.pointerEvents = 'auto';
    d.style.cursor = 'default';
    d.style.transition = 'opacity 220ms ease';
    d.style.opacity = '0';
    d.setAttribute('aria-hidden', 'true');
    document.documentElement.appendChild(d);
    __cs_badge = d;
    return d;
  } catch (e) {
    return null;
  }
}

function updateStatusBadge() {
  try {
    const d = createStatusBadge();
    if (!d) return;
    const parts = [];
    if (!__page_settings || !__page_settings.extensionEnabled) {
      d.style.opacity = '0';
      return;
    }
    if (__page_settings.enableProxy) parts.push('Proxy: ON');
    if (__page_settings.enableDecoys) parts.push('Decoys: ON');
    if (parts.length === 0) {
      d.style.opacity = '0';
      return;
    }
    d.textContent = 'Counter‑Spotting — ' + parts.join(' | ');
    d.style.opacity = '1';
  } catch (e) {}
}

function flashStatusBadge() {
  try {
    const d = createStatusBadge();
    if (!d) return;
    d.style.transition = 'transform 180ms ease, opacity 220ms ease';
    d.style.transform = 'scale(1.06)';
    d.style.opacity = '1';
    setTimeout(() => {
      try { d.style.transform = ''; } catch (e) {}
    }, 200);
    setTimeout(() => {
      try {
        if (!__page_settings.enableProxy && !__page_settings.enableDecoys) {
          d.style.opacity = '0';
        }
      } catch (e) {}
    }, 2000);
  } catch (e) {}
}

try { updateStatusBadge(); } catch (e) {}

let __cs_toast = null;
function createToast() {
  try {
    if (__cs_toast) return __cs_toast;
    const t = document.createElement('div');
    t.id = 'counter-spotting-toast';
    t.style.position = 'fixed';
    t.style.left = '50%';
    t.style.transform = 'translateX(-50%)';
    t.style.bottom = '72px';
    t.style.zIndex = '2147483647';
    t.style.background = 'rgba(255,223,90,0.92)'; /* yellow, slightly transparent */
    t.style.color = '#042a5b'; /* dark blue text */
    t.style.padding = '8px 12px';
    t.style.borderRadius = '6px';
    t.style.fontSize = '13px';
    t.style.fontFamily = 'Arial, sans-serif';
    t.style.boxShadow = '0 4px 14px rgba(4,42,91,0.12)';
    t.style.pointerEvents = 'none'; /* allow clicks to pass through */
    t.style.opacity = '0';
    t.style.transition = 'opacity 180ms ease, transform 180ms ease';
    document.documentElement.appendChild(t);
    __cs_toast = t;
    return t;
  } catch (e) {
    return null;
  }
}

function showToast(message, duration = 2200) {
  try {
    const t = createToast();
    if (!t) return;
    t.textContent = message;
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(t._hideTimer);
    t._hideTimer = setTimeout(() => {
      try { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(6px)'; } catch (e) {}
    }, duration);
  } catch (e) {}
}

function detectInteractionType(el) {
  try {
    if (!el) return null;
    const txt = (el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title')))
                || (el.textContent || '') || '';
    const cls = (el.className && String(el.className)) || '';
    const attrs = (el.getAttribute && el.getAttribute('data-testid')) || '';

    const s = (txt + ' ' + cls + ' ' + attrs).toLowerCase();
    if (/\b(like|liked|love|react)\b/.test(s)) return 'like';
    if (/\b(comment|reply|respond)\b/.test(s)) return 'comment';
    if (/\b(share|post)\b/.test(s)) return 'share';

    for (let i = 0; i < 3; i++) {
      el = el.parentElement;
      if (!el) break;
      const parentS = (el.getAttribute?.('aria-label') || el.getAttribute?.('data-testid') || el.className || '').toLowerCase();
      if (/\b(like|liked|love|react)\b/.test(parentS)) return 'like';
      if (/\b(comment|reply|respond)\b/.test(parentS)) return 'comment';
    }

    return null;
  } catch (e) {
    return null;
  }
}

function handleUserInteraction(el) {
  try {
    // Do nothing when extension is disabled
    if (!__page_settings || !__page_settings.extensionEnabled) return;

    const type = detectInteractionType(el);
    if (!type) return;

    const proxyOn = !!__page_settings.enableProxy;
    const decoyOn = !!__page_settings.enableDecoys;

    if (proxyOn && decoyOn) {
      showToast('Proxy routing in progress • Decoy traffic in effect');
    } else if (proxyOn) {
      showToast('Proxy routing in progress...');
    } else if (decoyOn) {
      showToast('Decoy traffic in effect');
    }
  } catch (e) {}
}

document.addEventListener('click', (event) => {
  try {
    const target = event.target;
    handleUserInteraction(target);
  } catch (e) {}
}, true);

document.addEventListener('submit', (event) => {
  try {
    const target = event.target;
    handleUserInteraction(target);
  } catch (e) {}
}, true);

const originalFetch = window.fetch;
window.fetch = function(resource, options) {
  try {
    const requestId = uuid();
    const payload = {
      url: String(resource),
      method: (options && options.method) || 'GET',
      headers: (options && options.headers) || {},
      body: (options && options.body) || null,
      requestId: requestId
    };

    window.postMessage({
      direction: 'from-page',
      type: 'sanitize-and-proxy-request',
      url: payload.url,
      method: payload.method,
      headers: payload.headers,
      body: payload.body,
      requestId: requestId
    }, '*');

    return waitForProxyResponse(requestId).then(response => {
      try {
        if (!response || !response.response) return originalFetch(resource, options);

        const { useProxy, proxyUrl, payload: proxiedPayload } = response.response;
        if (useProxy && proxyUrl && proxiedPayload) {
          flashStatusBadge();
          // Show toast only when a proxied request is actually used
          try {
            const proxyOn = true;
            const decoyOn = !!(__page_settings && __page_settings.enableDecoys);
            if (proxyOn && decoyOn) {
              showToast('Proxy routing in progress • Decoy traffic in effect');
            } else if (proxyOn) {
              showToast('Proxy routing in progress...');
            } else if (decoyOn) {
              showToast('Decoy traffic in effect');
            }
          } catch (e) {}

          return callProxy(proxyUrl, proxiedPayload);
        }

        return originalFetch(proxiedPayload.url, {
          method: proxiedPayload.method,
          headers: proxiedPayload.headers,
          body: proxiedPayload.body,
          ...options
        });
      } catch (err) {
        try {
          const m = err && err.message ? err.message : String(err);
          if (!/Extension context invalidated|message port closed|Receiving end does not exist/i.test(m)) {}
        } catch (e) {}
        return originalFetch(resource, options);
      }
    }).catch(fetchErr => {
      return originalFetch(resource, options);
    });
  } catch (fetchErr) {
    return originalFetch(resource, options);
  }
};

const originalXHR = window.XMLHttpRequest;
window.XMLHttpRequest = function() {
  const xhr = new originalXHR();
  const originalOpen = xhr.open;
  const originalSend = xhr.send;

  xhr.open = function(method, url, ...args) {
    try { xhr._requestUrl = url; xhr._requestMethod = method; } catch (e) {}
    return originalOpen.apply(xhr, [method, url, ...args]);
  };

  xhr.send = function(body) {
    const requestId = uuid();
    const payload = {
      url: xhr._requestUrl || '',
      method: xhr._requestMethod || 'GET',
      headers: {},
      body: body || null,
      requestId: requestId
    };

    window.postMessage({
      direction: 'from-page',
      type: 'sanitize-and-proxy-request',
      url: payload.url,
      method: payload.method,
      headers: payload.headers,
      body: payload.body,
      requestId: requestId
    }, '*');

    waitForProxyResponse(requestId).then(response => {
      try {
        if (!response || !response.response) {
          return originalSend.call(xhr, body);
        }

        const { useProxy, proxyUrl, payload: proxiedPayload } = response.response;
        if (useProxy && proxyUrl && proxiedPayload) {
          flashStatusBadge();
          // Show toast only when a proxied XHR is actually used
          try {
            const proxyOn = true;
            const decoyOn = !!(__page_settings && __page_settings.enableDecoys);
            if (proxyOn && decoyOn) {
              showToast('Proxy routing in progress • Decoy traffic in effect');
            } else if (proxyOn) {
              showToast('Proxy routing in progress...');
            } else if (decoyOn) {
              showToast('Decoy traffic in effect');
            }
          } catch (e) {}

          return callProxy(proxyUrl, proxiedPayload).then(resp => {
            try {
              xhr.responseText = resp?.body || '';
              xhr.status = resp?.status || 200;
              xhr.readyState = 4;
              xhr.dispatchEvent(new Event("readystatechange"));
              xhr.dispatchEvent(new Event("load"));
            } catch (err) {
              try {
                const m = err && err.message ? err.message : String(err);
                if (!/Extension context invalidated|message port closed|Receiving end does not exist/i.test(m)) {}
              } catch (e) {}
              xhr.readyState = 4;
              xhr.status = 500;
              xhr.dispatchEvent(new Event("readystatechange"));
              xhr.dispatchEvent(new Event("error"));
            }
          }).catch(err => {
            try {
              const m = err && err.message ? err.message : String(err);
              if (!/Extension context invalidated|message port closed|Receiving end does not exist/i.test(m)) {}
            } catch (e) {}
            originalSend.call(xhr, body);
          });
        }

        return originalSend.call(xhr, body);
      } catch (err) {
        return originalSend.call(xhr, body);
      }
    }).catch(err => {
      return originalSend.call(xhr, body);
    });
  };

  return xhr;
};

// injected script loaded
