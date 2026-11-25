import { DEFAULT_CONFIG, DEFAULT_PRIORITY_ORDER } from './locator-core/config';
import { LocatorKind, SupportedLanguage } from './locator-core/types';

declare const chrome: any;

const testIdInput = document.getElementById('testIdAttr') as HTMLInputElement;
const defaultLanguageSelect = document.getElementById('defaultLanguage') as HTMLSelectElement;
const priorityList = document.getElementById('priorityList') as HTMLUListElement;
const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;

let currentPriority: LocatorKind[] = [...DEFAULT_PRIORITY_ORDER];

function renderPriorityList() {
  priorityList.innerHTML = '';
  currentPriority.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'priority-item';

    const span = document.createElement('span');
    span.textContent = `${index + 1}. ${item}`;
    li.appendChild(span);

    const actions = document.createElement('div');
    actions.className = 'priority-actions';

    if (index > 0) {
      const upBtn = document.createElement('button');
      upBtn.textContent = '▲';
      upBtn.title = 'Move up';
      upBtn.addEventListener('click', () => {
        const temp = currentPriority[index - 1];
        currentPriority[index - 1] = currentPriority[index];
        currentPriority[index] = temp;
        renderPriorityList();
      });
      actions.appendChild(upBtn);
    }

    if (index < currentPriority.length - 1) {
      const downBtn = document.createElement('button');
      downBtn.textContent = '▼';
      downBtn.title = 'Move down';
      downBtn.addEventListener('click', () => {
        const temp = currentPriority[index + 1];
        currentPriority[index + 1] = currentPriority[index];
        currentPriority[index] = temp;
        renderPriorityList();
      });
      actions.appendChild(downBtn);
    }

    li.appendChild(actions);
    priorityList.appendChild(li);
  });
}

function loadSettings() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['testIdAttribute', 'priorityOrder', 'defaultLanguage'], items => {
      testIdInput.value = items.testIdAttribute || DEFAULT_CONFIG.testIdAttribute;
      defaultLanguageSelect.value = items.defaultLanguage || DEFAULT_CONFIG.defaultLanguage;
      if (items.priorityOrder && Array.isArray(items.priorityOrder) && items.priorityOrder.length > 0) {
        currentPriority = [...items.priorityOrder];
      } else {
        currentPriority = [...DEFAULT_PRIORITY_ORDER];
      }
      renderPriorityList();
    });
  } else {
    testIdInput.value = DEFAULT_CONFIG.testIdAttribute;
    defaultLanguageSelect.value = DEFAULT_CONFIG.defaultLanguage;
    currentPriority = [...DEFAULT_PRIORITY_ORDER];
    renderPriorityList();
  }
}

function saveSettings() {
  const testIdAttribute = testIdInput.value.trim() || DEFAULT_CONFIG.testIdAttribute;
  const defaultLanguage = defaultLanguageSelect.value as SupportedLanguage;
  const priorityOrder = [...currentPriority];

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.set(
      {
        testIdAttribute,
        defaultLanguage,
        priorityOrder,
      },
      () => {
        statusDiv.textContent = 'Settings saved successfully!';
        setTimeout(() => {
          statusDiv.textContent = '';
        }, 2000);
      }
    );
  } else {
    statusDiv.textContent = 'Settings saved (local memory).';
  }
}

function resetSettings() {
  testIdInput.value = DEFAULT_CONFIG.testIdAttribute;
  defaultLanguageSelect.value = DEFAULT_CONFIG.defaultLanguage;
  currentPriority = [...DEFAULT_PRIORITY_ORDER];
  renderPriorityList();
  saveSettings();
}

saveBtn.addEventListener('click', saveSettings);
resetBtn.addEventListener('click', resetSettings);

loadSettings();
