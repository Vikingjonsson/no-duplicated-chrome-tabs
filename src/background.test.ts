import { jest } from '@jest/globals';

const mockChrome = {
  tabs: {
    query: jest.fn<() => Promise<chrome.tabs.Tab[]>>(),
    update: jest.fn<() => Promise<chrome.tabs.Tab>>(),
    remove: jest.fn<() => Promise<void>>(),
    get: jest.fn<() => Promise<chrome.tabs.Tab>>(),
    onCreated: { addListener: jest.fn() },
    onUpdated: { addListener: jest.fn() },
    onAttached: { addListener: jest.fn() },
  },
  windows: {
    update: jest.fn<() => Promise<chrome.windows.Window>>(),
  },
};

(globalThis as any).chrome = mockChrome;

import {
  handleTabAttached,
  handleTabCreated,
  handleTabUpdated,
  isInSplitView,
  isSystemUrl,
  normalizeUrl,
} from './background-handlers';

describe('Chrome Extension - No Duplicate Tabs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle duplicate tab when new tab is created in same window', async () => {
    const existingTab = { id: 1, url: 'https://example.com', windowId: 1 } as chrome.tabs.Tab;
    const newTab = { id: 2, url: 'https://example.com', windowId: 1 } as chrome.tabs.Tab;

    mockChrome.tabs.query.mockResolvedValue([existingTab]);
    mockChrome.tabs.update.mockResolvedValue({} as chrome.tabs.Tab);
    mockChrome.windows.update.mockResolvedValue({} as chrome.windows.Window);
    mockChrome.tabs.remove.mockResolvedValue(undefined);

    await handleTabCreated(newTab);

    expect(mockChrome.tabs.query).toHaveBeenCalledWith({ windowId: 1 });
    expect(mockChrome.tabs.update).toHaveBeenCalledWith(1, { active: true });
    expect(mockChrome.windows.update).toHaveBeenCalledWith(1, { focused: true });
    expect(mockChrome.tabs.remove).toHaveBeenCalledWith(2);
  });

  it('should allow same URL in different windows', async () => {
    const newTab = { id: 2, url: 'https://example.com', windowId: 2 } as chrome.tabs.Tab;

    mockChrome.tabs.query.mockResolvedValue([]);

    await handleTabCreated(newTab);

    expect(mockChrome.tabs.query).toHaveBeenCalledWith({ windowId: 2 });
    expect(mockChrome.tabs.remove).not.toHaveBeenCalled();
  });

  it('should ignore chrome:// URLs when new tab is created', async () => {
    const newTab = { id: 1, url: 'chrome://newtab/' } as chrome.tabs.Tab;

    await handleTabCreated(newTab);

    expect(mockChrome.tabs.query).not.toHaveBeenCalled();
  });

  it('should handle URL updates during loading', async () => {
    const existingTab = { id: 1, url: 'https://example.com', windowId: 1 } as chrome.tabs.Tab;
    const updatedTab = { id: 2, url: 'https://example.com', windowId: 1 } as chrome.tabs.Tab;

    mockChrome.tabs.get.mockResolvedValue(updatedTab);
    mockChrome.tabs.query.mockResolvedValue([existingTab]);
    mockChrome.tabs.update.mockResolvedValue({} as chrome.tabs.Tab);
    mockChrome.tabs.remove.mockResolvedValue(undefined);

    await handleTabUpdated(2, { url: 'https://example.com', status: 'loading' });

    expect(mockChrome.tabs.get).toHaveBeenCalledWith(2);
    expect(mockChrome.tabs.query).toHaveBeenCalledWith({ windowId: 1 });
    expect(mockChrome.tabs.remove).toHaveBeenCalledWith(2);
  });

  it('should ignore URL updates when not loading', async () => {
    await handleTabUpdated(1, { url: 'https://example.com', status: 'complete' });

    expect(mockChrome.tabs.query).not.toHaveBeenCalled();
  });

  it('should ignore chrome-extension:// URLs', async () => {
    const newTab = { id: 1, url: 'chrome-extension://example' } as chrome.tabs.Tab;

    await handleTabCreated(newTab);

    expect(mockChrome.tabs.query).not.toHaveBeenCalled();
  });

  it('should ignore about:blank URLs', async () => {
    const newTab = { id: 1, url: 'about:blank' } as chrome.tabs.Tab;

    await handleTabCreated(newTab);

    expect(mockChrome.tabs.query).not.toHaveBeenCalled();
  });

  it('should remove duplicate when tab is moved to a window with same URL', async () => {
    const movedTab = { id: 3, url: 'https://example.com', windowId: 1 } as chrome.tabs.Tab;
    const existingTab = { id: 1, url: 'https://example.com', windowId: 1 } as chrome.tabs.Tab;

    mockChrome.tabs.get.mockResolvedValue(movedTab);
    mockChrome.tabs.query.mockResolvedValue([existingTab]);
    mockChrome.tabs.update.mockResolvedValue({} as chrome.tabs.Tab);
    mockChrome.windows.update.mockResolvedValue({} as chrome.windows.Window);
    mockChrome.tabs.remove.mockResolvedValue(undefined);

    await handleTabAttached(3, { newWindowId: 1, newPosition: 0 });

    expect(mockChrome.tabs.get).toHaveBeenCalledWith(3);
    expect(mockChrome.tabs.query).toHaveBeenCalledWith({ windowId: 1 });
    expect(mockChrome.tabs.update).toHaveBeenCalledWith(1, { active: true });
    expect(mockChrome.tabs.remove).toHaveBeenCalledWith(3);
  });

  it('should not remove duplicate when new tab is in split view', async () => {
    const existingTab = { id: 1, url: 'https://example.com', windowId: 1 } as chrome.tabs.Tab;
    const newTab = {
      id: 2,
      url: 'https://example.com',
      windowId: 1,
      splitViewId: 1,
    } as chrome.tabs.Tab;

    mockChrome.tabs.query.mockResolvedValue([existingTab]);

    await handleTabCreated(newTab);

    expect(mockChrome.tabs.remove).not.toHaveBeenCalled();
  });

  it('should not remove duplicate when existing tab is in split view', async () => {
    const existingTab = {
      id: 1,
      url: 'https://example.com',
      windowId: 1,
      splitViewId: 1,
    } as chrome.tabs.Tab;
    const newTab = { id: 2, url: 'https://example.com', windowId: 1 } as chrome.tabs.Tab;

    mockChrome.tabs.query.mockResolvedValue([existingTab]);

    await handleTabCreated(newTab);

    expect(mockChrome.tabs.remove).not.toHaveBeenCalled();
  });

  it('should keep tab when moved to a window without same URL', async () => {
    const movedTab = { id: 3, url: 'https://example.com', windowId: 2 } as chrome.tabs.Tab;

    mockChrome.tabs.get.mockResolvedValue(movedTab);
    mockChrome.tabs.query.mockResolvedValue([]);

    await handleTabAttached(3, { newWindowId: 2, newPosition: 0 });

    expect(mockChrome.tabs.query).toHaveBeenCalledWith({ windowId: 2 });
    expect(mockChrome.tabs.remove).not.toHaveBeenCalled();
  });

  it('should detect duplicate when new tab has pendingUrl instead of url', async () => {
    const existingTab = { id: 1, url: 'https://example.com', windowId: 1 } as chrome.tabs.Tab;
    const newTab = { id: 2, pendingUrl: 'https://example.com', windowId: 1 } as chrome.tabs.Tab;

    mockChrome.tabs.query.mockResolvedValue([existingTab]);
    mockChrome.tabs.update.mockResolvedValue({} as chrome.tabs.Tab);
    mockChrome.windows.update.mockResolvedValue({} as chrome.windows.Window);
    mockChrome.tabs.remove.mockResolvedValue(undefined);

    await handleTabCreated(newTab);

    expect(mockChrome.tabs.query).toHaveBeenCalledWith({ windowId: 1 });
    expect(mockChrome.tabs.remove).toHaveBeenCalledWith(2);
  });

  it('should match duplicate when existing tab has pendingUrl', async () => {
    const existingTab = {
      id: 1,
      pendingUrl: 'https://example.com',
      windowId: 1,
    } as chrome.tabs.Tab;
    const newTab = { id: 2, url: 'https://example.com', windowId: 1 } as chrome.tabs.Tab;

    mockChrome.tabs.query.mockResolvedValue([existingTab]);
    mockChrome.tabs.update.mockResolvedValue({} as chrome.tabs.Tab);
    mockChrome.windows.update.mockResolvedValue({} as chrome.windows.Window);
    mockChrome.tabs.remove.mockResolvedValue(undefined);

    await handleTabCreated(newTab);

    expect(mockChrome.tabs.remove).toHaveBeenCalledWith(2);
  });

  it('should normalize trailing slash on paths with query parameters', async () => {
    const existingTab = {
      id: 1,
      url: 'https://example.com/search/?q=jest',
      windowId: 1,
    } as chrome.tabs.Tab;
    const newTab = {
      id: 2,
      url: 'https://example.com/search?q=jest',
      windowId: 1,
    } as chrome.tabs.Tab;

    mockChrome.tabs.query.mockResolvedValue([existingTab]);
    mockChrome.tabs.update.mockResolvedValue({} as chrome.tabs.Tab);
    mockChrome.windows.update.mockResolvedValue({} as chrome.windows.Window);
    mockChrome.tabs.remove.mockResolvedValue(undefined);

    await handleTabCreated(newTab);

    expect(mockChrome.tabs.remove).toHaveBeenCalledWith(2);
  });

  it('should ignore edge:// and about: URLs', async () => {
    const edgeTab = { id: 1, url: 'edge://settings' } as chrome.tabs.Tab;
    const aboutNewTab = { id: 2, url: 'about:newtab' } as chrome.tabs.Tab;

    await handleTabCreated(edgeTab);
    await handleTabCreated(aboutNewTab);

    expect(mockChrome.tabs.query).not.toHaveBeenCalled();
  });

  it('should retry tab removal if initial attempt fails', async () => {
    const existingTab = { id: 1, url: 'https://example.com', windowId: 1 } as chrome.tabs.Tab;
    const newTab = { id: 2, url: 'https://example.com', windowId: 1 } as chrome.tabs.Tab;

    mockChrome.tabs.query.mockResolvedValue([existingTab]);
    mockChrome.tabs.update.mockResolvedValue({} as chrome.tabs.Tab);
    mockChrome.windows.update.mockResolvedValue({} as chrome.windows.Window);

    mockChrome.tabs.remove
      .mockRejectedValueOnce(new Error('Tabs cannot be edited during drag'))
      .mockResolvedValueOnce(undefined);

    await handleTabCreated(newTab);

    expect(mockChrome.tabs.remove).toHaveBeenCalledTimes(2);
  });

  it('should handle tab passed directly to handleTabUpdated without calling tabs.get', async () => {
    const existingTab = { id: 1, url: 'https://example.com', windowId: 1 } as chrome.tabs.Tab;
    const updatedTab = { id: 2, url: 'https://example.com', windowId: 1 } as chrome.tabs.Tab;

    mockChrome.tabs.query.mockResolvedValue([existingTab]);
    mockChrome.tabs.update.mockResolvedValue({} as chrome.tabs.Tab);
    mockChrome.windows.update.mockResolvedValue({} as chrome.windows.Window);
    mockChrome.tabs.remove.mockResolvedValue(undefined);

    await handleTabUpdated(2, { url: 'https://example.com' }, updatedTab);

    expect(mockChrome.tabs.get).not.toHaveBeenCalled();
    expect(mockChrome.tabs.remove).toHaveBeenCalledWith(2);
  });

  it('should gracefully handle tabs.get rejection in handleTabAttached', async () => {
    mockChrome.tabs.get.mockRejectedValue(new Error('Tab was closed'));

    await expect(
      handleTabAttached(99, { newWindowId: 1, newPosition: 0 })
    ).resolves.toBeUndefined();
  });

  it('should gracefully handle tabs.query failure in findDuplicateTabInWindow', async () => {
    const newTab = { id: 2, url: 'https://example.com', windowId: 1 } as chrome.tabs.Tab;
    mockChrome.tabs.query.mockRejectedValue(new Error('Window does not exist'));

    await handleTabCreated(newTab);

    expect(mockChrome.tabs.remove).not.toHaveBeenCalled();
  });

  describe('helpers', () => {
    it('normalizeUrl should return fallback on invalid URL', () => {
      expect(normalizeUrl('not-a-valid-url')).toBe('not-a-valid-url');
    });

    it('isInSplitView should correctly identify split view states', () => {
      expect(isInSplitView({ splitViewId: 1 } as chrome.tabs.Tab)).toBe(true);
      expect(isInSplitView({ splitViewId: -1 } as chrome.tabs.Tab)).toBe(false);
      expect(isInSplitView({ splitViewId: 0 } as chrome.tabs.Tab)).toBe(false);
      expect(isInSplitView({} as chrome.tabs.Tab)).toBe(false);
    });

    it('isSystemUrl should identify all supported internal protocols', () => {
      expect(isSystemUrl('chrome://settings')).toBe(true);
      expect(isSystemUrl('devtools://devtools/bundled/inspector.html')).toBe(true);
      expect(isSystemUrl('edge://extensions')).toBe(true);
      expect(isSystemUrl('brave://flags')).toBe(true);
      expect(isSystemUrl('about:blank')).toBe(true);
      expect(isSystemUrl('view-source:https://example.com')).toBe(true);
      expect(isSystemUrl('javascript:void(0)')).toBe(true);
      expect(isSystemUrl('data:text/html,hello')).toBe(true);
      expect(isSystemUrl('https://example.com')).toBe(false);
    });
  });
});
