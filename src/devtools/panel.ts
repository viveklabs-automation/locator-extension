import { LocatorCandidate, SupportedLanguage } from '../locator-core/types';
import { DEFAULT_CONFIG } from '../locator-core/config';

let currentCandidates: LocatorCandidate[] = [];
let currentLanguage: SupportedLanguage = 'typescript';
let isPicking = false;

declare const chrome: any;

const pickBtn = document.getElementById('pickBtn') as HTMLButtonElement;
const pickText = document.getElementById('pickText') as HTMLSpanElement;
const langSelect = document.getElementById('langSelect') as HTMLSelectElement;
const targetInfo = document.getElementById('target-info') as HTMLDivElement;
const candidatesContainer = document.getElementById('candidates-container') as HTMLDivElement;

// Load settings
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
  chrome.storage.sync.get(['defaultLanguage'], items => {
    if (items.defaultLanguage) {
      currentLanguage = items.defaultLanguage;
      langSelect.value = currentLanguage;
    }
  });
}

function updateCandidatesView() {
  if (currentCandidates.length === 0) {
    candidatesContainer.innerHTML = `
      <div id="empty-state">
        <p>No element picked yet.</p>
      </div>
    `;
    return;
  }

  candidatesContainer.innerHTML = '';

  currentCandidates.forEach((candidate, idx) => {
    const card = document.createElement('div');
    card.className = 'candidate-card';

    const header = document.createElement('div');
    header.className = 'candidate-header';

    const badgeGroup = document.createElement('div');
    badgeGroup.className = 'badge-group';

    const methodBadge = document.createElement('span');
    methodBadge.className = 'badge badge-method';
    methodBadge.textContent = candidate.kind;
    badgeGroup.appendChild(methodBadge);

    const statusBadge = document.createElement('span');
    if (candidate.strategy === 'direct' && candidate.isUnique) {
      statusBadge.className = 'badge badge-unique';
      statusBadge.textContent = 'Unique (1 match)';
    } else if (candidate.strategy === 'scoped') {
      statusBadge.className = 'badge badge-scoped';
      statusBadge.textContent = 'Scoped';
    } else if (candidate.strategy === 'filtered') {
      statusBadge.className = 'badge badge-scoped';
      statusBadge.textContent = 'Filtered';
    } else {
      statusBadge.className = 'badge badge-nth';
      statusBadge.textContent = '.nth()';
    }
    badgeGroup.appendChild(statusBadge);
    header.appendChild(badgeGroup);

    const codeContainer = document.createElement('div');
    codeContainer.className = 'code-container';

    const codeSnippet = candidate.code[currentLanguage] || candidate.code.typescript;

    const pre = document.createElement('pre');
    pre.textContent = codeSnippet;

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(codeSnippet);
        copyBtn.textContent = 'Copied!';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.textContent = 'Copy';
          copyBtn.classList.remove('copied');
        }, 1500);
      } catch (err) {
        console.error('Clipboard copy failed:', err);
      }
    });

    codeContainer.appendChild(pre);
    codeContainer.appendChild(copyBtn);

    card.appendChild(header);
    card.appendChild(codeContainer);
    candidatesContainer.appendChild(card);
  });
}

function setPicking(picking: boolean) {
  isPicking = picking;
  if (isPicking) {
    pickBtn.classList.add('inspecting');
    pickText.textContent = 'Picking... (Esc to cancel)';
    targetInfo.innerHTML = 'Hover and click any element on the page, or press <strong>Esc</strong> to cancel.';
  } else {
    pickBtn.classList.remove('inspecting');
    pickText.textContent = 'Pick Element';
  }
}

pickBtn.addEventListener('click', () => {
  if (typeof chrome === 'undefined' || !chrome.tabs) return;

  const tabId = chrome.devtools?.inspectedWindow?.tabId;

  if (isPicking) {
    setPicking(false);
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { type: 'STOP_INSPECT' });
    }
  } else {
    setPicking(true);
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { type: 'START_INSPECT' });
    }
  }
});

langSelect.addEventListener('change', () => {
  currentLanguage = langSelect.value as SupportedLanguage;
  updateCandidatesView();
});

// Listen for messages from content script
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener(msg => {
    if (msg.type === 'PLAYWRIGHT_LOCATOR_PICKED') {
      setPicking(false);
      currentCandidates = msg.candidates || [];
      targetInfo.textContent = `Picked <${msg.tagName}> with ${currentCandidates.length} candidate locators:`;
      updateCandidatesView();
    } else if (msg.type === 'PLAYWRIGHT_LOCATOR_INSPECT_STOPPED') {
      setPicking(false);
    }
  });
}
