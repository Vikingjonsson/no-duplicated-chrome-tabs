const IGNORED_URL_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'chrome-search://',
  'chrome-untrusted://',
  'devtools://',
  'edge://',
  'brave://',
  'view-source:',
  'about:',
  'data:',
  'javascript:',
];
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 200;

const SPLIT_VIEW_ID_NONE = -1;

export const isSystemUrl = (url: string): boolean => {
  return IGNORED_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
};

export const isInSplitView = (tab: chrome.tabs.Tab): boolean => {
  return (
    typeof tab.splitViewId === 'number' &&
    tab.splitViewId !== SPLIT_VIEW_ID_NONE &&
    tab.splitViewId > 0
  );
};

export const normalizeUrl = (url: string): string => {
  try {
    const parsedUrl = new URL(url);
    parsedUrl.hash = '';
    parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/, '') || '/';
    return parsedUrl.toString().replace(/\/$/, '');
  } catch {
    return url;
  }
};

export const getTabUrl = (tab: chrome.tabs.Tab): string | undefined => {
  return tab.pendingUrl || tab.url;
};

export const findDuplicateTabInWindow = async (
  targetUrl: string,
  excludeTabId: number,
  windowId: number
): Promise<chrome.tabs.Tab | null> => {
  const normalizedTargetUrl = normalizeUrl(targetUrl);

  try {
    const tabsInWindow = await chrome.tabs.query({ windowId });
    const matchingTab = tabsInWindow.find((tab) => {
      if (tab.id === excludeTabId || isInSplitView(tab)) {
        return false;
      }
      const candidateUrl = getTabUrl(tab);
      return candidateUrl ? normalizeUrl(candidateUrl) === normalizedTargetUrl : false;
    });
    return matchingTab || null;
  } catch {
    return null;
  }
};

export const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export const activateTab = async (tabId: number, windowId?: number): Promise<void> => {
  await chrome.tabs.update(tabId, { active: true });
  if (windowId) {
    await chrome.windows.update(windowId, { focused: true });
  }
};

export const focusExistingAndRemoveDuplicate = async (
  existingTab: chrome.tabs.Tab,
  duplicateTabId: number,
  remainingRetries = MAX_RETRY_ATTEMPTS
): Promise<void> => {
  if (!existingTab.id) return;

  let activated = false;
  try {
    await activateTab(existingTab.id, existingTab.windowId);
    activated = true;
    await chrome.tabs.remove(duplicateTabId);
  } catch {
    if (remainingRetries > 0) {
      await wait(RETRY_DELAY_MS);
      if (activated) {
        try {
          await chrome.tabs.remove(duplicateTabId);
          return;
        } catch {
          return focusExistingAndRemoveDuplicate(existingTab, duplicateTabId, remainingRetries - 1);
        }
      }
      return focusExistingAndRemoveDuplicate(existingTab, duplicateTabId, remainingRetries - 1);
    }
  }
};

export const detectAndRemoveDuplicate = async (tab: chrome.tabs.Tab): Promise<void> => {
  const url = getTabUrl(tab);
  if (!url || !tab.id || !tab.windowId) return;
  if (isSystemUrl(url)) return;
  if (isInSplitView(tab)) return;

  const duplicateTab = await findDuplicateTabInWindow(url, tab.id, tab.windowId);
  if (duplicateTab) {
    await focusExistingAndRemoveDuplicate(duplicateTab, tab.id);
  }
};

export const handleTabCreated = (tab: chrome.tabs.Tab): Promise<void> => {
  return detectAndRemoveDuplicate(tab);
};

export const handleTabAttached = async (
  tabId: number,
  attachInfo: chrome.tabs.OnAttachedInfo
): Promise<void> => {
  try {
    const tab = await chrome.tabs.get(tabId);
    const windowId = attachInfo.newWindowId ?? tab.windowId;
    await detectAndRemoveDuplicate({ ...tab, windowId });
  } catch {
    // Tab may have been closed before we could read it
  }
};

export const handleTabUpdated = async (
  tabId: number,
  changeInfo: chrome.tabs.OnUpdatedInfo,
  tab?: chrome.tabs.Tab
): Promise<void> => {
  if (changeInfo.status === 'complete') {
    return;
  }

  const hasNewUrl = Boolean(changeInfo.url);
  const isLoading = changeInfo.status === 'loading';

  if (!hasNewUrl && !isLoading) {
    return;
  }

  try {
    const currentTab = tab ?? (await chrome.tabs.get(tabId));
    const targetUrl = changeInfo.url || getTabUrl(currentTab);
    if (!targetUrl) return;

    await detectAndRemoveDuplicate({
      ...currentTab,
      url: targetUrl,
    });
  } catch {
    // Tab may have been closed before we could read it
  }
};
