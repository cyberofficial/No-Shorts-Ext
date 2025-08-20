// Persistent toast for counter
let counterToastTimeout = null;
let counterToastActive = false;
let lastCounterValue = 0;
let showCounterToastEnabled = false;

// Load showCounterToastEnabled from storage
chrome.storage.sync.get(['show_counter_toast'], (result) => {
  showCounterToastEnabled = !!result.show_counter_toast;
});

// Listen for changes to the option
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.show_counter_toast) {
    showCounterToastEnabled = !!changes.show_counter_toast.newValue;
  }
});

function showCounterToast(count) {
  let toast = document.getElementById('shorts-counter-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'shorts-counter-toast';
    toast.style.position = 'fixed';
    toast.style.top = '32px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = 'rgba(32,32,32,0.97)';
    toast.style.color = '#81c784';
    toast.style.fontSize = '1.45rem';
    toast.style.fontWeight = 'bold';
    toast.style.padding = '20px 48px 28px 48px';
    toast.style.borderRadius = '12px';
    toast.style.boxShadow = '0 2px 24px rgba(0,0,0,0.28)';
    toast.style.zIndex = '99999';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    toast.style.textAlign = 'center';
    toast.style.letterSpacing = '0.01em';
    toast.innerHTML = '';
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '1'; }, 10);
  }
  toast.innerHTML = `<span style="font-size:1.1em;color:#fff;display:block;margin-bottom:0.2em;">Shorts Hidden from View so far:</span><span style="font-size:2.1em;font-weight:800;color:#81c784;">${count}</span>`;
  toast.style.opacity = '1';
  counterToastActive = true;
  // Reset timer
  if (counterToastTimeout) clearTimeout(counterToastTimeout);
  counterToastTimeout = setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 350);
    counterToastActive = false;
  }, 5000);
}

// No Shorts Ext content script (toggleable)
// Removes Shorts shelf and Shorts videos from YouTube search results if enabled


let shortsRemovalEnabled = false;
let zapModeEnabled = false;
let zapDelay = 1; // default to 1s

// Sync state with background on load
const SHORTS_KEY = 'shorts_removal_enabled';
const tabId = (() => {
  try {
    // Try to get tabId from chrome.runtime if available (MV3 context)
    if (chrome && chrome.runtime && chrome.runtime.id) {
      // Use chrome.runtime.getURL to get tabId if possible (not always available)
      // Fallback: ask background for tabId
      return null;
    }
  } catch {}
  return null;
})();


// Ask background for the current toggle state for this tab and get zap mode and delay
function syncStateAndZap() {
  chrome.runtime.sendMessage({ type: 'SHORTS_QUERY_STATE' }, (response) => {
    if (response && typeof response.enabled === 'boolean') {
      shortsRemovalEnabled = response.enabled;
      chrome.storage.sync.get(['zap_mode', 'zap_delay'], (result) => {
        zapModeEnabled = !!result.zap_mode;
        zapDelay = typeof result.zap_delay === 'number' ? result.zap_delay : 1;
        if (shortsRemovalEnabled) removeShorts();
      });
    }
  });
}
syncStateAndZap();



// Increment Shorts hidden counter in chrome.storage.local

function incrementShortsHiddenCounter() {
  chrome.storage.local.get(['shorts_hidden_count'], (result) => {
    const current = result.shorts_hidden_count ? result.shorts_hidden_count : 0;
    const next = current + 1;
    chrome.storage.local.set({ shorts_hidden_count: next }, () => {
      if (showCounterToastEnabled) {
        showCounterToast(next);
      }
    });
  });
}

function zapAndRemove(node) {
  if (!node) return;
  setTimeout(() => {
    node.classList.add('no-shorts-zap');
    setTimeout(() => {
      if (node.parentNode) node.parentNode.removeChild(node);
      incrementShortsHiddenCounter();
    }, 1100);
  }, Math.round(zapDelay * 1000));
}

function removeShorts() {
    // Remove Shorts shelf: ytd-reel-shelf-renderer under #contents with title containing 'Shorts'
    const contents = document.querySelector('#contents');
    if (contents) {
      const reelShelves = contents.querySelectorAll('ytd-reel-shelf-renderer');
      reelShelves.forEach(shelf => {
        const titleSpan = shelf.querySelector('#title');
        if (titleSpan && titleSpan.textContent && titleSpan.textContent.toLowerCase().includes('shorts')) {
          if (shelf.parentNode) {
            if (zapModeEnabled) {
              zapAndRemove(shelf);
            } else {
              shelf.parentNode.removeChild(shelf);
              incrementShortsHiddenCounter();
            }
          }
        }
      });
    }
    // Remove Shorts sidebar: #sections if any badge-shape-wiz__text is under 1:00
    const sections = document.querySelector('#sections');
    if (sections) {
      const timeBadges = sections.querySelectorAll('.badge-shape-wiz__text');
      let hasShort = false;
      for (const badge of timeBadges) {
        const text = badge.textContent.trim();
        // Match mm:ss or ss
        const match = text.match(/^(\d{1,2}):(\d{2})$/) || text.match(/^(\d{1,2})$/);
        if (match) {
          let seconds = 0;
          if (match.length === 3) {
            // mm:ss
            seconds = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
          } else if (match.length === 2) {
            // ss only
            seconds = parseInt(match[1], 10);
          }
          if (seconds < 60) {
            hasShort = true;
            break;
          }
        }
      }
      if (hasShort && sections.parentNode) {
        if (zapModeEnabled) {
          zapAndRemove(sections);
        } else {
          sections.parentNode.removeChild(sections);
          incrementShortsHiddenCounter();
        }
      }
    }
    // Remove Shorts sidebar: #items containing only ytd-watch-card-compact-video-renderer
    const sidebarItems = document.querySelector('#items');
    if (sidebarItems) {
      const children = Array.from(sidebarItems.children);
      if (
        children.length > 0 &&
        children.every(
          el => el.tagName === 'YTD-WATCH-CARD-COMPACT-VIDEO-RENDERER'
        )
      ) {
        if (sidebarItems.parentNode) {
          if (zapModeEnabled) {
            zapAndRemove(sidebarItems);
          } else {
            sidebarItems.parentNode.removeChild(sidebarItems);
            incrementShortsHiddenCounter();
          }
        }
      }
    }
  try {
    if (shortsRemovalEnabled) {
      // Remove Shorts shelf (any grid-shelf-view-model with header containing 'Shorts')
      const shelves = document.querySelectorAll('#contents > grid-shelf-view-model');
      shelves.forEach(shelf => {
        // Look for any header/title span containing 'Shorts' (case-insensitive, partial match)
        const headerSpans = shelf.querySelectorAll('span');
        for (const span of headerSpans) {
          if (span.textContent && span.textContent.toLowerCase().includes('shorts')) {
            if (shelf.parentNode) {
              // Count all Shorts video items in the shelf
              let count = 0;
              // Try to find all grid shelf items (Shorts videos)
              const gridRows = shelf.querySelectorAll('div.ytGridShelfViewModelGridShelfRow');
              gridRows.forEach(row => {
                count += row.querySelectorAll('div.ytGridShelfViewModelGridShelfItem').length;
              });
              if (count === 0) {
                // fallback: try to count direct grid items if structure changes
                count = shelf.querySelectorAll('div.ytGridShelfViewModelGridShelfItem').length;
              }
              if (count > 0) {
                for (let i = 0; i < count; i++) incrementShortsHiddenCounter();
              } else {
                incrementShortsHiddenCounter();
              }
              if (zapModeEnabled) {
                zapAndRemove(shelf);
              } else {
                shelf.parentNode.removeChild(shelf);
              }
            }
            break;
          }
        }
      });

      // Remove Shorts videos from search results
      const videoNodes = document.querySelectorAll('ytd-video-renderer');
      videoNodes.forEach(node => {
        const link = node.querySelector('a#thumbnail');
        if (link && link.href && link.href.includes('/shorts/')) {
          if (node.parentNode) {
            if (zapModeEnabled) {
              zapAndRemove(node);
            } else {
              node.parentNode.removeChild(node);
              incrementShortsHiddenCounter();
            }
          }
        }
      });

      // Remove Shorts button from sidebar guide (robust: check title, aria-label, and text)
      const guideItems = document.querySelectorAll('#items ytd-guide-entry-renderer');
      const sidebarShortsEntry = document.querySelector('#items > ytd-guide-entry-renderer:nth-child(2)');
      guideItems.forEach(item => {
        // Check for Shorts by title attribute, aria-label, or visible text
        const titleAttr = (item.getAttribute('title') || '').trim().toLowerCase();
        const ariaLabel = (item.getAttribute('aria-label') || '').trim().toLowerCase();
        const endpoint = item.querySelector('a#endpoint');
        const endpointTitle = endpoint ? (endpoint.getAttribute('title') || '').trim().toLowerCase() : '';
        const endpointAria = endpoint ? (endpoint.getAttribute('aria-label') || '').trim().toLowerCase() : '';
        const titleSpan = item.querySelector('yt-formatted-string.title');
        const text = titleSpan && titleSpan.textContent ? titleSpan.textContent.trim().toLowerCase() : '';
        if (
          titleAttr === 'shorts' ||
          ariaLabel === 'shorts' ||
          endpointTitle === 'shorts' ||
          endpointAria === 'shorts' ||
          text === 'shorts'
        ) {
          if (item.parentNode) {
            if (zapModeEnabled) {
              // Zap mode always increments counter, even for sidebar entry
              zapAndRemove(item);
            } else {
              item.parentNode.removeChild(item);
              if (item !== sidebarShortsEntry) {
                incrementShortsHiddenCounter();
              }
            }
          }
        }
      });

      // Remove Shorts tab from tab group
      const shortsTabs = document.querySelectorAll('yt-tab-shape');
      const specialShortsTab = document.querySelector('#tabsContent > yt-tab-group-shape > div.yt-tab-group-shape-wiz__tabs > yt-tab-shape:nth-child(3)');
      shortsTabs.forEach(tab => {
        // Check for tab with text 'Shorts' (case-insensitive)
        const tabDiv = tab.querySelector('.yt-tab-shape-wiz__tab');
        if (tabDiv && tabDiv.textContent && tabDiv.textContent.trim().toLowerCase() === 'shorts') {
          if (tab.parentNode) {
            if (zapModeEnabled) {
              zapAndRemove(tab);
            } else {
              tab.parentNode.removeChild(tab);
              if (tab !== specialShortsTab) {
                incrementShortsHiddenCounter();
              }
            }
          }
        }
      });

      // Remove Shorts lockup elements on user pages
      const shortsLockups = document.querySelectorAll('ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2');
      shortsLockups.forEach(lockup => {
        const shortsLink = lockup.querySelector('a[href*="/shorts/"]');
        if (shortsLink && lockup.parentNode) {
          if (zapModeEnabled) {
            zapAndRemove(lockup);
          } else {
            lockup.parentNode.removeChild(lockup);
            incrementShortsHiddenCounter();
          }
        }
      });

      // Remove Shorts in yt-lockup-view-model (e.g., inside #contents)
      const lockupNodes = document.querySelectorAll('yt-lockup-view-model');
      lockupNodes.forEach(node => {
        const shortsLink = node.querySelector('a[href*="/shorts/"]');
        if (shortsLink && node.parentNode) {
          if (zapModeEnabled) {
            zapAndRemove(node);
          } else {
            node.parentNode.removeChild(node);
            incrementShortsHiddenCounter();
          }
        }
      });
    }
  } catch (e) {
    // Fail silently, but log for debugging
    // console.error('No Shorts Ext error:', e);
  }
}
// Zap Mode animation CSS
if (!document.getElementById('no-shorts-zap-style')) {
  const zapStyle = document.createElement('style');
  zapStyle.id = 'no-shorts-zap-style';
  zapStyle.textContent = `
    .no-shorts-zap {
      animation: no-shorts-zap-anim 1.1s cubic-bezier(.7,0,.3,1) forwards;
    }
    @keyframes no-shorts-zap-anim {
      0% { opacity: 1; transform: scale(1) rotate(0deg); filter: none; box-shadow: 0 0 0 0 #fff0; }
      15% { transform: scale(1.08) rotate(-2deg) skewX(2deg); filter: brightness(1.2) blur(0.5px); box-shadow: 0 0 8px 2px #fff8; }
      35% { transform: scale(1.18) rotate(-8deg) skewX(8deg); filter: brightness(1.5) blur(1.5px); box-shadow: 0 0 24px 8px #ff0, 0 0 32px 16px #fff8; }
      55% { transform: scale(1.25) rotate(6deg) skewX(-6deg); filter: brightness(2.2) blur(2.5px); box-shadow: 0 0 48px 24px #fff, 0 0 64px 32px #ff0; }
      75% { opacity: 0.7; transform: scale(0.9) rotate(12deg) skewX(-12deg); filter: brightness(2.5) blur(4px); box-shadow: 0 0 64px 32px #fff, 0 0 96px 48px #ff0; }
      100% { opacity: 0; transform: scale(1.7) rotate(32deg) skewX(24deg); filter: brightness(3.5) blur(12px); box-shadow: 0 0 0 0 #fff0; }
    }
  `;
  document.head.appendChild(zapStyle);
}

// Listen for toggle messages from background

// Toast notification logic
function showShortsToast(enabled) {
  // Remove any existing toast
  const oldToast = document.getElementById('no-shorts-toast');
  if (oldToast) oldToast.remove();
  const oldStyle = document.getElementById('no-shorts-toast-style');
  if (!oldStyle) {
    // Inject style block only once
    const style = document.createElement('style');
    style.id = 'no-shorts-toast-style';
    style.textContent = `
      #no-shorts-toast {
        position: fixed;
        top: 32px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(32,32,32,0.97);
        color: #fff;
        font-size: 1.35rem;
        font-weight: bold;
        padding: 20px 48px 28px 48px;
        border-radius: 12px;
        box-shadow: 0 2px 24px rgba(0,0,0,0.28);
        z-index: 99999;
        opacity: 0;
        transition: opacity 0.3s;
        text-align: center;
        letter-spacing: 0.01em;
      }
      #no-shorts-toast.show {
        opacity: 1;
      }
      #no-shorts-toast .no-shorts-toast-msg {
        margin-bottom: 0;
      }
      #no-shorts-toast .no-shorts-toast-timer {
        position: absolute;
        left: 0;
        bottom: 0;
        height: 5px;
        width: 100%;
        background: linear-gradient(90deg, #4caf50, #2196f3);
        border-radius: 0 0 12px 12px;
        transform: scaleX(1);
        transform-origin: left;
        transition: transform 1.8s linear;
      }
      #no-shorts-toast.hide {
        opacity: 0;
      }
    `;
    document.head.appendChild(style);
  }

  const toast = document.createElement('div');
  toast.id = 'no-shorts-toast';
  toast.className = '';
  toast.textContent = '';

  // Toast message
  const msg = document.createElement('div');
  msg.className = 'no-shorts-toast-msg';
  // Use Zap Mode messages if enabled
  if (zapModeEnabled) {
    msg.textContent = enabled ? 'Zap Zap ⚡' : 'They shall live for now...';
  } else {
    msg.textContent = enabled ? 'Shorts will no longer be shown.' : 'Will stop checking for shorts.';
  }
  toast.appendChild(msg);

  // Timer bar
  const timer = document.createElement('div');
  timer.className = 'no-shorts-toast-timer';
  toast.appendChild(timer);

  document.body.appendChild(toast);
  setTimeout(() => { toast.classList.add('show'); }, 10);
  setTimeout(() => { timer.style.transform = 'scaleX(0)'; }, 50);
  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => { toast.remove(); }, 350);
  }, 1850);
}


chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'SHORTS_TOGGLE') {
    shortsRemovalEnabled = !!msg.enabled;
    chrome.storage.sync.get(['zap_mode', 'zap_delay'], (result) => {
      zapModeEnabled = !!result.zap_mode;
      zapDelay = typeof result.zap_delay === 'number' ? result.zap_delay : 1;
      removeShorts();
      showShortsToast(shortsRemovalEnabled);
    });
  }
});


// Set up a single MutationObserver to handle dynamic content
const observer = new MutationObserver(() => {
  removeShorts();
});
observer.observe(document.body, { childList: true, subtree: true });

// Also run removeShorts once after DOM is loaded and after window load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    removeShorts();
  });
} else {
  removeShorts();
}
window.addEventListener('load', () => {
  removeShorts();
});

// --- SPA navigation fix for YouTube (2025-08-20) ---
// Listen for YouTube navigation events and re-run removeShorts
const ytNavEvents = [
  'yt-navigate-finish',
  'yt-page-data-updated',
  'yt-location-changed'
];
ytNavEvents.forEach(evt => {
  window.addEventListener(evt, () => {
    setTimeout(removeShorts, 1); // slight delay to allow DOM update
  });
});
// Also listen for popstate (history navigation)
window.addEventListener('popstate', () => {
  setTimeout(removeShorts, 1);
});
