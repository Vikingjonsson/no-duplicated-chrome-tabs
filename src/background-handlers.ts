const IGNORED_URL_PREFIXES = ['chrome://', 'chrome-extension://', 'about:blank'];
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 200;

const SPLIT_VIEW_ID_NONE = -1;

const isSystemUrl = (url: string): boolean => {
  return IGNORED_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
};

const isInSplitView = (tab: chrome.tabs.Tab): boolean => {
  return tab.splitViewId !== undefined && tab.splitViewId !== SPLIT_VIEW_ID_NONE;
};

const normalizeUrl = (url: string): string => {
  try {
    const parsedUrl = new URL(url);
    parsedUrl.hash = '';
    return parsedUrl.toString().replace(/\/$/, '');
  } catch {
    return url;
  }
};

const findDuplicateTabInWindow = async (
  targetUrl: string,
  excludeTabId: number,
  windowId: number
): Promise<chrome.tabs.Tab | null> => {
  const normalizedTargetUrl = normalizeUrl(targetUrl);

  try {
    const tabsInWindow = await chrome.tabs.query({ windowId });
    const matchingTab = tabsInWindow.find(
      (tab) =>
        tab.id !== excludeTabId &&
        tab.url &&
        !isInSplitView(tab) &&
        normalizeUrl(tab.url) === normalizedTargetUrl
    );
    return matchingTab || null;
  } catch {
    return null;
  }
};

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const activateTab = async (tabId: number, windowId?: number): Promise<void> => {
  await chrome.tabs.update(tabId, { active: true });
  if (windowId) {
    await chrome.windows.update(windowId, { focused: true });
  }
};

const focusExistingAndRemoveDuplicate = async (
  existingTab: chrome.tabs.Tab,
  duplicateTabId: number,
  remainingRetries = MAX_RETRY_ATTEMPTS
): Promise<void> => {
  if (!existingTab.id) return;

  try {
    await activateTab(existingTab.id, existingTab.windowId);
    await chrome.tabs.remove(duplicateTabId);
  } catch {
    if (remainingRetries > 0) {
      await wait(RETRY_DELAY_MS);
      return focusExistingAndRemoveDuplicate(existingTab, duplicateTabId, remainingRetries - 1);
    }
  }
};

const detectAndRemoveDuplicate = async (tab: chrome.tabs.Tab): Promise<void> => {
  if (!tab.url || !tab.id || !tab.windowId) return;
  if (isSystemUrl(tab.url)) return;
  if (isInSplitView(tab)) return;

  const duplicateTab = await findDuplicateTabInWindow(tab.url, tab.id, tab.windowId);
  if (duplicateTab) {
    await focusExistingAndRemoveDuplicate(duplicateTab, tab.id);
  }
};

export const handleTabCreated = (tab: chrome.tabs.Tab): Promise<void> => {
  return detectAndRemoveDuplicate(tab);
};

export const handleTabAttached = async (
  tabId: number,
  _attachInfo: chrome.tabs.OnAttachedInfo
): Promise<void> => {
  try {
    const tab = await chrome.tabs.get(tabId);
    await detectAndRemoveDuplicate(tab);
  } catch {
    // Tab may have been closed before we could read it
  }
};

export const handleTabUpdated = async (
  tabId: number,
  changeInfo: chrome.tabs.OnUpdatedInfo
): Promise<void> => {
  if (changeInfo.url && changeInfo.status === 'loading') {
    try {
      const tab = await chrome.tabs.get(tabId);
      return detectAndRemoveDuplicate(tab);
    } catch {
      // Tab may have been closed before we could read it
    }
  }
};
