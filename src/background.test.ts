import { jest } from '@jest/globals';

const mockChrome = {
  tabs: {
    query: jest.fn<() => Promise<chrome.tabs.Tab[]>>(),
    update: jest.fn<() => Promise<chrome.tabs.Tab>>(),
    remove: jest.fn<() => Promise<void>>(),
    onCreated: { addListener: jest.fn() },
    onUpdated: { addListener: jest.fn() },
  },
  windows: {
    update: jest.fn<() => Promise<chrome.windows.Window>>(),
  },
};

(globalThis as any).chrome = mockChrome;

describe('Chrome Extension - No Duplicate Tabs', () => {
  it('should handle duplicate tab when new tab is created', async () => {
    const { handleTabCreated } = await import('./background-handlers');

    const existingTab = { id: 1, url: 'https://example.com', windowId: 1 } as chrome.tabs.Tab;
    const newTab = { id: 2, url: 'https://example.com' } as chrome.tabs.Tab;

    mockChrome.tabs.query.mockResolvedValue([existingTab]);
    mockChrome.tabs.update.mockResolvedValue({} as chrome.tabs.Tab);
    mockChrome.windows.update.mockResolvedValue({} as chrome.windows.Window);
    mockChrome.tabs.remove.mockResolvedValue(undefined);

    await handleTabCreated(newTab);

    await new Promise<void>((resolve) => setTimeout(resolve, 10));

    expect(mockChrome.tabs.update).toHaveBeenCalledWith(1, { active: true });
    expect(mockChrome.windows.update).toHaveBeenCalledWith(1, { focused: true });
    expect(mockChrome.tabs.remove).toHaveBeenCalledWith(2);
  });

  it('should ignore chrome:// URLs when new tab is created', async () => {
    const { handleTabCreated } = await import('./background-handlers');

    const newTab = { id: 1, url: 'chrome://newtab/' } as chrome.tabs.Tab;

    await handleTabCreated(newTab);

    expect(mockChrome.tabs.query).not.toHaveBeenCalled();
  });

  it('should handle URL updates during loading', async () => {
    const { handleTabUpdated } = await import('./background-handlers');

    const existingTab = { id: 1, url: 'https://example.com' } as chrome.tabs.Tab;

    mockChrome.tabs.query.mockResolvedValue([existingTab]);
    mockChrome.tabs.update.mockResolvedValue({} as chrome.tabs.Tab);
    mockChrome.tabs.remove.mockResolvedValue(undefined);

    await handleTabUpdated(2, { url: 'https://example.com', status: 'loading' });

    await new Promise<void>((resolve) => setTimeout(resolve, 10));

    expect(mockChrome.tabs.remove).toHaveBeenCalledWith(2);
  });

  it('should ignore URL updates when not loading', async () => {
    const { handleTabUpdated } = await import('./background-handlers');

    await handleTabUpdated(1, { url: 'https://example.com', status: 'complete' });

    expect(mockChrome.tabs.query).not.toHaveBeenCalled();
  });

  it('should ignore chrome-extension:// URLs', async () => {
    const { handleTabCreated } = await import('./background-handlers');

    const newTab = { id: 1, url: 'chrome-extension://example' } as chrome.tabs.Tab;

    await handleTabCreated(newTab);

    expect(mockChrome.tabs.query).not.toHaveBeenCalled();
  });

  it('should ignore about:blank URLs', async () => {
    const { handleTabCreated } = await import('./background-handlers');

    const newTab = { id: 1, url: 'about:blank' } as chrome.tabs.Tab;

    await handleTabCreated(newTab);

    expect(mockChrome.tabs.query).not.toHaveBeenCalled();
  });
});
