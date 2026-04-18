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

import { handleTabAttached, handleTabCreated, handleTabUpdated } from './background-handlers';

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
});
