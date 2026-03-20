# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Chrome Extension (Manifest V3) that prevents duplicate tabs by focusing existing tabs with the same URL instead of creating new ones. Built with TypeScript, bundled with webpack, targeting the `webworker` runtime (Chrome service worker).

## Commands

- `npm test` — run Jest tests
- `npm run test:watch` — run tests in watch mode
- `npm run build` — dev build (webpack dev config + copies manifest to dist/)
- `npm run build:prod` — production build (minified, copies manifest + icons to dist/)
- `npm run lint` — ESLint on src/**/*.ts
- `npm run lint:fix` — auto-fix lint issues
- `npm run format` — Prettier format
- `npm run format:check` — check formatting
- `npm run type-check` — TypeScript type checking without emit
- `npm run validate` — type-check + lint + test (runs on pre-push via husky)
- `npm run zip` — build prod and create extension.zip for distribution

## Architecture

All source lives in `src/`. The entry point is `src/background.ts`, which registers Chrome event listeners. The actual handler logic is in `src/background-handlers.ts` — this separation exists so handlers can be imported and tested independently without triggering listener registration.

Key behavior flow: `handleTabCreated` / `handleTabUpdated` → `handleTab` → `findDuplicateTab` → `focusAndRemove`. URLs are normalized (hash removed, trailing slash stripped) and system URLs (chrome://, chrome-extension://, about:blank) are ignored.

Tests are co-located (`src/background.test.ts`) and mock the `chrome` global API.

## Build Output

Webpack outputs to `dist/`. The manifest references `background.js` directly (no subdirectory). The build copies `manifest.json` and icons into `dist/` so the entire `dist/` folder can be loaded as an unpacked extension.

## Lint/Format

ESLint + Prettier are integrated — Prettier violations are ESLint errors. Husky + lint-staged run on pre-commit. Unused vars prefixed with `_` are allowed.
