declare const chrome: any;

chrome.devtools.panels.create(
  'Playwright Locators',
  '',
  'src/devtools/panel.html',
  () => {
    console.log('Playwright Locators panel created');
  }
);
