# Playwright Locator Generator (Chrome & Edge DevTools Extension)

A Manifest V3 browser extension for Playwright test engineers that generates robust locators for picked elements and inspects live DOM elements (including open shadow roots and iframes).

---

## Features (Phase 1)

- **Inspect Mode**: Hover highlights any element with an overlay badge showing tag, dimensions, and test attributes; click picks the element. Supports open shadow DOM (`shadowRoot`) and nested contexts.
- **Priority Order Generation**:
  1. `getByTestId` (configurable attribute, default `data-testid`)
  2. `getByRole` with accessible name (ARIA roles and HTML5 semantics)
  3. `getByLabel` (associated `<label for="...">` or wrapping `<label>`)
  4. `getByPlaceholder`
  5. `getByText`
  6. `getByAltText`
  7. `getByTitle`
  8. CSS selector (sanitized from Angular `_ngcontent-*` tokens)
  9. XPath fallback
- **Uniqueness Guard**: Verifies candidate uniqueness against the DOM. If multiple elements match, candidates are systematically refined using:
  - Parent container scoping (e.g., scoping under unique card test-id or role)
  - `.filter({ hasText: '...' })`
  - `.nth(index)` as a safe fallback
- **Multi-Language Code Output**: Generates ready-to-use Playwright code for:
  - **TypeScript**
  - **JavaScript**
  - **Python**
  - **Java**
- **Settings Page**: Configurable test-id attribute name (e.g. `data-testid`, `data-test`, `data-cy`), customizable priority ordering, and default output language.
- **Pure Core Engine**: Built as `locator-core` without browser-extension dependencies so it can be shared with Node test runners.

---

## Getting Started

### 1. Prerequisites
- Node.js (v18+)
- npm

### 2. Install Dependencies
```bash
npm install
```

### 3. Build the Extension
```bash
npm run build
```
This produces the distribution files in the `dist/` directory.

### 4. Run Vitest Unit Tests
To test the core generator against Angular and React markup fixtures:
```bash
npm test
```

---

## Loading the Unpacked Extension

### Google Chrome
1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** using the toggle switch in the top-right corner.
3. Click the **Load unpacked** button.
4. Select the `dist` directory located inside this project (`locator_extension/dist`).
5. Open any webpage, press `F12` to open DevTools, and click the **Playwright Locators** panel tab.

### Microsoft Edge
1. Open Edge and navigate to `edge://extensions`.
2. Enable **Developer mode** using the toggle switch on the left sidebar.
3. Click **Load unpacked**.
4. Select the `dist` directory located inside this project (`locator_extension/dist`).
5. Open DevTools (`F12`), and select the **Playwright Locators** tab.

---

## Usage

1. Open DevTools (`F12`) on any page and click the **Playwright Locators** tab.
2. Click **Pick Element**.
3. Hover over the element you want to inspect (a blue highlight box with element details will follow your cursor).
4. Click to pick the element (or press `Escape` to cancel).
5. Review the ranked candidate locators, choose your preferred target language, and click **Copy**.
6. Click the extension toolbar icon to open **Settings** and customize the test-id attribute or priority sequence.
