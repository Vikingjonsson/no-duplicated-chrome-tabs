import { handleTabAttached, handleTabCreated, handleTabUpdated } from './background-handlers';

chrome.tabs.onCreated.addListener(handleTabCreated);
chrome.tabs.onUpdated.addListener(handleTabUpdated);
chrome.tabs.onAttached.addListener(handleTabAttached);
