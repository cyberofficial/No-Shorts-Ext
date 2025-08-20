// Add context menu for extension icon to open options page
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'no-shorts-options',
    title: 'Options...',
    contexts: ['action']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'no-shorts-options') {
    chrome.runtime.openOptionsPage();
  }
});
// Respond to content script's state query
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'SHORTS_QUERY_STATE') {
    const tabId = sender.tab && sender.tab.id;
    if (!tabId) {
      sendResponse({ enabled: false });
      return;
    }
    const key = `${SHORTS_KEY}_${tabId}`;
    chrome.storage.local.get(key).then(async result => {
      if (result[key] === undefined) {
        // Use default from sync storage if no per-tab state
        const sync = await chrome.storage.sync.get('shorts_default');
        const enabled = sync.shorts_default === 'on';
        sendResponse({ enabled });
      } else {
        sendResponse({ enabled: !!result[key] });
      }
    });
    // Indicate async response
    return true;
  }
});
// background.js - Handles toggle state and icon for Shorts removal

const SHORTS_KEY = 'shorts_removal_enabled';

// Set default state to false on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: 'OFF' });
  chrome.action.setBadgeBackgroundColor({ color: '#d32f2f' }); // Red for OFF
});

// Always keep badge in sync when tab is updated or activated
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, async (tab) => {
    if (!tab || !tab.url || !tab.url.startsWith('https://www.youtube.com/')) {
      chrome.action.setBadgeText({ tabId: activeInfo.tabId, text: '' });
      return;
    }
    const key = `${SHORTS_KEY}_${activeInfo.tabId}`;
    const result = await chrome.storage.local.get(key);
    let enabled = !!result[key];
    if (result[key] === undefined) {
      // Use default from sync storage if no per-tab state
      const sync = await chrome.storage.sync.get('shorts_default');
      enabled = sync.shorts_default === 'on';
    }
    chrome.action.setBadgeText({ tabId: activeInfo.tabId, text: enabled ? 'ON' : 'OFF' });
    chrome.action.setBadgeBackgroundColor({ tabId: activeInfo.tabId, color: enabled ? '#388e3c' : '#d32f2f' }); // Green for ON, Red for OFF
  });
});
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    if (!tab || !tab.url || !tab.url.startsWith('https://www.youtube.com/')) {
      chrome.action.setBadgeText({ tabId, text: '' });
      return;
    }
    const key = `${SHORTS_KEY}_${tabId}`;
    const result = await chrome.storage.local.get(key);
    let enabled = !!result[key];
    if (result[key] === undefined) {
      const sync = await chrome.storage.sync.get('shorts_default');
      enabled = sync.shorts_default === 'on';
    }
    chrome.action.setBadgeText({ tabId, text: enabled ? 'ON' : 'OFF' });
    chrome.action.setBadgeBackgroundColor({ tabId, color: enabled ? '#388e3c' : '#d32f2f' });
  }
});

// Toggle Shorts removal on icon click
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  const key = `${SHORTS_KEY}_${tab.id}`;
  const result = await chrome.storage.local.get(key);
    // Default to false if not set, or use default from sync storage
    let current = !!result[key];
    if (result[key] === undefined) {
      const sync = await chrome.storage.sync.get('shorts_default');
      current = sync.shorts_default === 'on';
    }
    const enabled = !current;
  await chrome.storage.local.set({ [key]: enabled });
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'SHORTS_TOGGLE', enabled });
  } catch (e) {
    // Ignore errors if content script is not present on the page
  }
  chrome.action.setBadgeText({ tabId: tab.id, text: enabled ? 'ON' : 'OFF' });
  chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: enabled ? '#388e3c' : '#d32f2f' });
});

// Clean up state when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  const key = `${SHORTS_KEY}_${tabId}`;
  chrome.storage.local.remove(key);
});
