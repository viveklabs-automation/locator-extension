import { generateLocators } from '../locator-core/generator';
import { GeneratorConfig } from '../locator-core/types';
import { DEFAULT_CONFIG } from '../locator-core/config';

let isInspecting = false;
let overlay: HTMLDivElement | null = null;
let tooltip: HTMLDivElement | null = null;
let lastTarget: Element | null = null;
let currentConfig: GeneratorConfig = { ...DEFAULT_CONFIG };

// Load user settings if available
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
  chrome.storage.sync.get(['testIdAttribute', 'priorityOrder', 'defaultLanguage'], items => {
    if (items.testIdAttribute) currentConfig.testIdAttribute = items.testIdAttribute;
    if (items.priorityOrder) currentConfig.priorityOrder = items.priorityOrder;
    if (items.defaultLanguage) currentConfig.defaultLanguage = items.defaultLanguage;
  });
}

function getDeepElement(e: MouseEvent): Element | null {
  const path = e.composedPath();
  for (const item of path) {
    if (item instanceof Element) {
      if (item === overlay || item === tooltip) continue;
      return item;
    }
  }
  return null;
}

function createOverlay() {
  if (overlay) return;

  overlay = document.createElement('div');
  overlay.id = '__playwright_locator_overlay__';
  Object.assign(overlay.style, {
    position: 'fixed',
    pointerEvents: 'none',
    border: '2px solid #0284c7',
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    zIndex: '2147483647',
    transition: 'all 0.05s ease-out',
    display: 'none',
    boxSizing: 'border-box',
    borderRadius: '2px',
  });

  tooltip = document.createElement('div');
  tooltip.id = '__playwright_locator_tooltip__';
  Object.assign(tooltip.style, {
    position: 'fixed',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    fontSize: '11px',
    fontFamily: 'ui-monospace, monospace',
    padding: '3px 6px',
    borderRadius: '4px',
    zIndex: '2147483647',
    pointerEvents: 'none',
    display: 'none',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    whiteSpace: 'nowrap',
  });

  document.documentElement.appendChild(overlay);
  document.documentElement.appendChild(tooltip);
}

function removeOverlay() {
  if (overlay && overlay.parentElement) overlay.parentElement.removeChild(overlay);
  if (tooltip && tooltip.parentElement) tooltip.parentElement.removeChild(tooltip);
  overlay = null;
  tooltip = null;
}

function handleMouseMove(e: MouseEvent) {
  if (!isInspecting) return;
  const target = getDeepElement(e);
  if (!target || target === lastTarget) return;
  lastTarget = target;

  if (!overlay || !tooltip) createOverlay();

  const rect = target.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return;

  if (overlay) {
    overlay.style.display = 'block';
    overlay.style.top = `${rect.top}px`;
    overlay.style.left = `${rect.left}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
  }

  if (tooltip) {
    tooltip.style.display = 'block';
    const tag = target.tagName.toLowerCase();
    const testId = target.getAttribute(currentConfig.testIdAttribute);
    const textInfo = testId ? ` [${currentConfig.testIdAttribute}="${testId}"]` : '';
    tooltip.textContent = `<${tag}>${textInfo} (${Math.round(rect.width)}x${Math.round(rect.height)})`;

    let tipTop = rect.top - 24;
    if (tipTop < 0) tipTop = rect.bottom + 4;
    let tipLeft = Math.max(0, rect.left);

    tooltip.style.top = `${tipTop}px`;
    tooltip.style.left = `${tipLeft}px`;
  }
}

function handleClick(e: MouseEvent) {
  if (!isInspecting) return;
  e.preventDefault();
  e.stopPropagation();

  const target = getDeepElement(e);
  stopInspect();

  if (target) {
    const candidates = generateLocators(target, currentConfig);
    const tagName = target.tagName.toLowerCase();

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'PLAYWRIGHT_LOCATOR_PICKED',
        tagName,
        candidates,
      });
    }
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isInspecting) {
    stopInspect();
  }
}

export function startInspect() {
  if (isInspecting) return;
  isInspecting = true;
  createOverlay();
  window.addEventListener('mousemove', handleMouseMove, true);
  window.addEventListener('click', handleClick, true);
  window.addEventListener('keydown', handleKeyDown, true);
}

export function stopInspect() {
  if (!isInspecting) return;
  isInspecting = false;
  removeOverlay();
  lastTarget = null;
  window.removeEventListener('mousemove', handleMouseMove, true);
  window.removeEventListener('click', handleClick, true);
  window.removeEventListener('keydown', handleKeyDown, true);

  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.sendMessage({ type: 'PLAYWRIGHT_LOCATOR_INSPECT_STOPPED' });
  }
}

// Listen for messages from DevTools panel / popup
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'START_INSPECT') {
      if (message.config) currentConfig = { ...currentConfig, ...message.config };
      startInspect();
      sendResponse({ status: 'started' });
    } else if (message.type === 'STOP_INSPECT') {
      stopInspect();
      sendResponse({ status: 'stopped' });
    }
    return true;
  });
}
