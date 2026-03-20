# No Duplicate Chrome Tabs Extension

A TypeScript Chrome extension that automatically prevents duplicate tabs by focusing existing tabs with the same URL instead of creating new ones.

## Features

- Automatically detects when a duplicate tab is being created
- Focuses the existing tab and removes the duplicate
- Handles cross-window tab focusing
- Ignores system URLs (chrome://, chrome-extension://, about:blank)
- Normalizes URLs by removing hash fragments and trailing slashes

## Installation

1. Clone this repository
2. Install dependencies: `npm install`
3. Build the extension: `npm run build:prod`
4. Open Chrome and navigate to `chrome://extensions/`
5. Enable "Developer mode"
6. Click "Load unpacked" and select the `dist` directory

## Development

### Setup

```bash
npm install
```

### Scripts

- `npm run build` - Dev build (unminified, with source maps)
- `npm run build:prod` - Production build (minified, with icons)
- `npm run build:watch` - Dev build in watch mode
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Run ESLint on TypeScript files
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run type-check` - TypeScript type checking
- `npm run validate` - Run type-check, lint, and tests
- `npm run clean` - Remove build artifacts
- `npm run zip` - Build production and create extension.zip

### Project Structure

```
src/
├── background.ts              # Entry point, registers Chrome event listeners
├── background-handlers.ts     # Tab deduplication logic
├── background.test.ts         # Tests
dist/                          # Build output (generated)
├── background.js
├── manifest.json
```
