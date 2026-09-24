---
description: Chrome Extension MV3, Tab Deduplication, and Test Conventions
---

# Project Conventions & Guidelines

## 1. Chrome MV3 Service Worker Constraints
- The background script runs as a Manifest V3 service worker (`webworker` runtime). Avoid DOM APIs (`window`, `document`) and stateful global memory across service worker lifecycles.
- Listeners must remain registered synchronously in `src/background.ts` at the top level so they are ready upon service worker awakening.

## 2. Listener & Handler Separation
- Keep event listener registrations (`chrome.tabs.onCreated`, `chrome.tabs.onUpdated`, `chrome.tabs.onAttached`) strictly in `src/background.ts`.
- Core business logic and helper functions reside in `src/background-handlers.ts`. Do not attach event listeners or introduce side effects directly inside `src/background-handlers.ts`.

## 3. Tab Deduplication & Retry Logic
- Deduplication is strictly scoped per window (`chrome.tabs.query({ windowId })`). Duplicate URLs across distinct windows are permitted.
- Support both `tab.pendingUrl` and `tab.url` to catch newly opened or navigating tabs before URL commit.
- Cross-window drag-and-drop (`onAttached`) can trigger Chrome's transient tab editing lock ("Tabs cannot be edited right now (user may be dragging a tab)"). `focusExistingAndRemoveDuplicate` must retry up to 3 times with a 200ms delay. If tab activation succeeded, subsequent retries only target removal.
- Exclude tabs participating in Chrome Split View (`tab.splitViewId > 0`).
- Whitelist and ignore internal/system URL schemes (`chrome://`, `chrome-extension://`, `chrome-search://`, `chrome-untrusted://`, `edge://`, `brave://`, `devtools://`, `about:`, `view-source:`, `data:`, `javascript:`).

## 4. URL Normalization
- URLs must be normalized via `normalizeUrl`: strip `#` hash fragments and remove trailing slashes from pathnames, including URLs with search/query parameters (e.g. `https://example.com/foo/?q=1` -> `https://example.com/foo?q=1`).

## 5. Verification & Testing
- Always run `npm run validate` (`type-check` + `lint` + `test:ci`) before finishing tasks.
- Tests in `src/background.test.ts` mock Chrome APIs in-memory. Ensure all new URL cases, retries, and edge cases are thoroughly covered.
