// background.ts – minimal service worker
declare const chrome: any;

chrome.runtime.onInstalled.addListener(() => {
  console.log('Playwright Locator Generator installed');
});
