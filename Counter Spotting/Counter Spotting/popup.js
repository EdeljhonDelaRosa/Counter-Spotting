document.addEventListener("DOMContentLoaded", async () => {
  const extensionEnabled = document.getElementById("extensionEnabled");
  const enableProxy = document.getElementById("enableProxy");
  const enableDecoys = document.getElementById("enableDecoys");
  const decoyRate = document.getElementById("decoyRate");
  const applyBtn = document.getElementById("applySettings");
  const statusLog = document.getElementById("statusLog");

  chrome.storage.local.get({
    enableProxy: false,
    enableDecoys: false,
    decoyRate: 0.25,
    extensionEnabled: false,
    showReadme: true
  }, (data) => {
    extensionEnabled.checked = data.extensionEnabled;
    enableProxy.checked = data.enableProxy;
    enableDecoys.checked = data.enableDecoys;
    decoyRate.value = data.decoyRate;
    statusLog.textContent = data.extensionEnabled ? "Extension enabled." : "Extension disabled.";

    try {
      if (!data.extensionEnabled && data.showReadme) {
        const modal = document.getElementById('onboardModal');
        const readmeArea = document.getElementById('onboardReadme');
        const dontShow = document.getElementById('onboardDontShow');
        if (modal && readmeArea) {
          fetch(chrome.runtime.getURL('readme.txt')).then(r => r.ok ? r.text() : 'Unable to load instructions.').then(t => {
            readmeArea.textContent = summarizeReadme(t);
          }).catch(() => { readmeArea.textContent = 'Unable to load instructions.'; });

          dontShow.checked = false;
          modal.style.display = 'block';
        }
      }
    } catch (e) {}
  });

  extensionEnabled.addEventListener("change", () => {
    const isEnabled = extensionEnabled.checked;
    enableProxy.disabled = !isEnabled;
    enableDecoys.disabled = !isEnabled;
    decoyRate.disabled = !isEnabled;
  });

  applyBtn.addEventListener("click", () => {
    const settings = {
      extensionEnabled: extensionEnabled.checked,
      enableProxy: enableProxy.checked,
      enableDecoys: enableDecoys.checked,
      decoyRate: parseFloat(decoyRate.value)
    };

    chrome.storage.local.set(settings, () => {
      try {
        chrome.runtime.sendMessage({ type: 'settings-changed', payload: settings }, (resp) => { try { if (chrome.runtime && chrome.runtime.lastError) return; } catch (e) {} });
      } catch (e) {}

      try {
        chrome.runtime.sendMessage({
          type: "update-settings",
          payload: settings
        }, (response) => {
          try {
            if (chrome.runtime.lastError) {
              const msg = chrome.runtime.lastError.message || "";
              if (!msg.includes("message port closed") && !msg.includes("Extension context")) {}
            }
          } catch (lastErrorErr) {}
        });
      } catch (err) {}

      if (settings.extensionEnabled) {
        try {
          chrome.runtime.sendMessage({
            type: "set-decoy-config",
            enabled: settings.enableDecoys,
            rate: settings.decoyRate
          }, (response) => {
            try {
              if (chrome.runtime.lastError) {
                const msg = chrome.runtime.lastError.message || "";
                if (!msg.includes("message port closed") && !msg.includes("Extension context")) {}
              }
            } catch (lastErrorErr) {}
          });
        } catch (err) {}
      }

      statusLog.textContent = settings.extensionEnabled ? "Settings applied!" : "Extension disabled.";
      setTimeout(() => {
        statusLog.textContent = settings.extensionEnabled ? "Ready." : "Extension disabled.";
      }, 2000);
    });
  });

  const showInstructions = document.getElementById('showInstructions');
  const modal = document.getElementById('onboardModal');
  const readmeArea = document.getElementById('onboardReadme');
  const dontShow = document.getElementById('onboardDontShow');
  const onboardNext = document.getElementById('onboardNext');
  const onboardBack = document.getElementById('onboardBack');

  function summarizeReadme(text) {
    if (!text) return '';
    const lines = text.split(/\r?\n/).filter(Boolean);
    const preview = lines.slice(0, 12).join('\n');
    if (preview.length > 800) return preview.slice(0, 800) + '...';
    return preview;
  }

  if (showInstructions) {
    showInstructions.addEventListener('click', () => {
      try {
        if (readmeArea) {
          fetch(chrome.runtime.getURL('readme.txt')).then(r => r.ok ? r.text() : 'Unable to load instructions.').then(t => {
            readmeArea.textContent = summarizeReadme(t);
            if (modal) modal.style.display = 'block';
          }).catch(() => {
            if (readmeArea) readmeArea.textContent = 'Unable to load instructions.';
            if (modal) modal.style.display = 'block';
          });
        } else if (modal) {
          modal.style.display = 'block';
        }
      } catch (e) {}
    });
  }

  if (onboardBack) {
    onboardBack.addEventListener('click', () => {
      try { if (modal) modal.style.display = 'none'; } catch (e) {}
    });
  }

  if (onboardNext) {
    onboardNext.addEventListener('click', () => {
      try {
        const dont = !!(dontShow && dontShow.checked);
        const settings = { extensionEnabled: true, enableProxy: false, enableDecoys: false, showReadme: !dont };
        chrome.storage.local.set(settings, () => {
          try {
            chrome.runtime.sendMessage({ type: 'onboarding-done', enable: true, showReadme: !dont }, (resp) => { try { if (chrome.runtime && chrome.runtime.lastError) {} } catch (e) {} });
          } catch (e) {}
          try {
            chrome.runtime.sendMessage({ type: 'settings-changed', payload: settings }, (resp) => { try { if (chrome.runtime && chrome.runtime.lastError) return; } catch (e) {} });
          } catch (e) {}
          try { if (modal) modal.style.display = 'none'; } catch (e) {}
          try { extensionEnabled.checked = true; enableProxy.checked = false; enableDecoys.checked = false; enableProxy.disabled = false; enableDecoys.disabled = false; statusLog.textContent = 'Extension enabled.'; } catch (e) {}
        });
      } catch (e) {
        try { if (modal) modal.style.display = 'none'; } catch (ex) {}
      }
    });
  }
});
