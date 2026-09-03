import { handleTabAttached, handleTabCreated, handleTabUpdated } from './background-handlers';

chrome.tabs.onCreated.addListener(handleTabCreated);
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  void handleTabUpdated(tabId, changeInfo, tab);
});
chrome.tabs.onAttached.addListener(handleTabAttached);
