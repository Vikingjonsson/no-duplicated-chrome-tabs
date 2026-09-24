# AGENTS.md

This file provides guidance and technical context for Google Antigravity and AI coding agents working with code in this repository.

## Project Overview

A Chrome Extension (Manifest V3) that automatically prevents duplicate tabs by focusing existing tabs with the same URL instead of creating new ones. Built with TypeScript, bundled with Webpack, and runs in the Chrome background service worker (`webworker` runtime).

## Development Commands

- `npm test` — Run unit tests with Jest (`watchman: false`, `node` environment)
- `npm run test:watch` — Run Jest tests in watch mode
- `npm run test:ci` — Run Jest tests with coverage and in CI mode
- `npm run build` — Development build with source maps (assets automatically copied to `dist/`)
- `npm run build:prod` — Production build (minified, assets automatically copied to `dist/`)
- `npm run build:watch` — Development build in watch mode with automatic asset synchronization
- `npm run lint` — Run ESLint on `src/**/*.ts`
- `npm run lint:fix` — Auto-fix ESLint issues
- `npm run format` — Format code with Prettier
- `npm run format:check` — Check code formatting with Prettier
- `npm run type-check` — TypeScript type checking without emit (`tsc --noEmit`) across source and test files
- `npm run validate` — Full validation pipeline (`type-check` + `lint` + `test:ci`), run automatically on pre-push
- `npm run zip` — Build production bundle and package `extension.zip` for distribution
- `npm run clean` — Remove build artifacts (`dist/`, `extension.zip`)

## Architecture & Code Structure

All source code is located in `src/`:

```
src/
├── background.ts          # Entry point: registers Chrome extension event listeners
├── background-handlers.ts # Tab deduplication core logic and helper utilities
└── background.test.ts     # Jest unit tests with Chrome API mocks
```

### Flow & Core Logic

1. **Listener Registration**: `src/background.ts` registers event listeners for:
   - `chrome.tabs.onCreated` → `handleTabCreated`
   - `chrome.tabs.onUpdated` → `handleTabUpdated`
   - `chrome.tabs.onAttached` → `handleTabAttached`
   *(Listeners are kept separate from handler logic so handlers can be tested in isolation without triggering side-effects.)*

2. **Deduplication Pipeline**:
   - `handleTabCreated` / `handleTabUpdated` / `handleTabAttached` → `detectAndRemoveDuplicate` → `findDuplicateTabInWindow` → `focusExistingAndRemoveDuplicate`.

3. **Key Deduplication Behaviors**:
   - **Per-Window Scoping**: Duplicate detection is scoped strictly per window (`chrome.tabs.query({ windowId })`). The same URL is intentionally allowed across separate browser windows.
   - **Cross-Window Drag & Attach**: When a tab is moved between windows, `chrome.tabs.onAttached` triggers deduplication in the target window using `attachInfo.newWindowId`.
   - **Transient Drag Retries**: Chrome locks tab modifications while tabs are being dragged. `focusExistingAndRemoveDuplicate` retries up to 3 times with a 200ms delay if tab operations fail. If tab activation succeeded, subsequent retries only target removal.
   - **Pending URLs**: The extension checks `tab.pendingUrl || tab.url` to catch newly opened or navigating tabs before their URL commit.
   - **URL Normalization**: `normalizeUrl` strips `#` hash fragments and removes trailing slashes from pathnames, including URLs with search/query parameters (e.g. `https://example.com/foo/?q=1` matches `https://example.com/foo?q=1`).
   - **Split View Exclusion**: Tabs participating in Chrome Split View (`tab.splitViewId > 0`) are ignored to avoid closing paired split screens.
   - **Internal & System URLs**: Internal protocols (`chrome://`, `chrome-extension://`, `chrome-search://`, `chrome-untrusted://`, `edge://`, `brave://`, `devtools://`, `about:`, `view-source:`, `data:`, `javascript:`) are ignored.

## Build Setup

- **Webpack & TypeScript**: All configuration files (`webpack.config.ts`, `webpack.dev.config.ts`, `jest.config.ts`) are TypeScript.
- **Node vs Source Configs**: Webpack configs use `tsconfig.node.json` (CommonJS + Node types) via `TS_NODE_PROJECT=tsconfig.node.json`, separate from `tsconfig.json` (ES2022 modules + DOM/Chrome/Node types).
- **Asset Copying**: `CopyExtensionAssetsPlugin` in Webpack configurations uses Node's `fs.cpSync` to automatically copy `manifest.json` and `icons/` into `dist/` during both dev, watch, and prod builds.
- **Unpacked Loading**: The entire `dist/` directory can be loaded directly into Chrome as an unpacked extension via `chrome://extensions/`.

## Code Quality & Conventions

- **Linting & Formatting**: ESLint and Prettier are integrated. Prettier formatting violations are treated as ESLint errors. Base rule `no-unused-vars` is turned off in favor of `@typescript-eslint/no-unused-vars` (variables prefixed with `_` are permitted).
- **Git Hooks**: Managed via Husky v9 in `.husky/`:
  - `.husky/pre-commit`: runs `npx lint-staged`
  - `.husky/pre-push`: runs `npm run validate`
- **Testing**: Tests in `src/background.test.ts` mock `chrome` globally. Tests run in a `node` environment (avoid DOM-only APIs as the extension runs in a service worker).

## Guidelines for AI Agents

- Always run `npm run validate` before completing tasks to verify type-checking, linting, and unit tests pass.
- Do not combine listener attachment side-effects into `src/background-handlers.ts`.
- When modifying URL handling, ensure trailing slashes, query parameters, and system URL whitelists are properly handled and tested.
