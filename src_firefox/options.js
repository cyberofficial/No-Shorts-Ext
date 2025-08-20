const showCounterToastCheckbox = document.getElementById('showCounterToast');
const resetBtn = document.getElementById('resetShortsCounterBtn');
if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset the Shorts Hidden counter? This cannot be undone.')) {
      chrome.storage.local.set({ shorts_hidden_count: 0 }, () => {
        shortsHiddenCount.textContent = 0;
      });
    }
  });
}
// Options page for No Shorts Ext


const select = document.getElementById('defaultToggle');
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toast-msg');
const toastTimer = document.getElementById('toast-timer');
const zapCheckbox = document.getElementById('zapModeToggle');
const zapDelaySelect = document.getElementById('zapDelaySelect');
const shortsHiddenCount = document.getElementById('shortsHiddenCount');



// Load current default, zap mode, zap delay, showCounterToast, and shorts hidden counter from storage
chrome.storage.sync.get(['shorts_default', 'zap_mode', 'zap_delay', 'show_counter_toast'], (result) => {
  select.value = result.shorts_default === 'on' ? 'on' : 'off';
  zapCheckbox.checked = !!result.zap_mode;
  zapDelaySelect.value = result.zap_delay ? String(result.zap_delay) : '1';
  if (showCounterToastCheckbox) showCounterToastCheckbox.checked = !!result.show_counter_toast;
});
if (showCounterToastCheckbox) {
  showCounterToastCheckbox.addEventListener('change', () => {
    chrome.storage.sync.set({ show_counter_toast: showCounterToastCheckbox.checked });
  });
}

// Load persistent Shorts hidden counter from chrome.storage.local
function updateShortsHiddenCount() {
  chrome.storage.local.get(['shorts_hidden_count'], (result) => {
    shortsHiddenCount.textContent = result.shorts_hidden_count ? result.shorts_hidden_count : 0;
  });
}
updateShortsHiddenCount();

// Listen for changes to the counter in case it updates while options is open
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.shorts_hidden_count) {
    shortsHiddenCount.textContent = changes.shorts_hidden_count.newValue;
  }
});

function showToast(message, duration = 1500) {
  toastMsg.textContent = message;
  toast.classList.add('show');
  toast.style.display = 'flex';
  toastTimer.style.transition = 'none';
  toastTimer.style.transform = 'scaleX(1)';
  // Force reflow for transition
  void toastTimer.offsetWidth;
  toastTimer.style.transition = `transform ${duration}ms linear`;
  toastTimer.style.transform = 'scaleX(0)';
  setTimeout(() => {
    toast.classList.remove('show');
    toast.style.display = 'none';
  }, duration);
}

select.addEventListener('change', () => {
  const value = select.value;
  chrome.storage.sync.set({ shorts_default: value }, () => {
    showToast('Saved!', 1500);
  });
});


zapCheckbox.addEventListener('change', () => {
  const zap = zapCheckbox.checked;
  chrome.storage.sync.set({ zap_mode: zap }, () => {
    showToast('Saved!', 1500);
  });
});

zapDelaySelect.addEventListener('change', () => {
  const delay = parseFloat(zapDelaySelect.value);
  chrome.storage.sync.set({ zap_delay: delay }, () => {
    showToast('Saved!', 1500);
  });
});
