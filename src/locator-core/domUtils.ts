/**
 * domUtils.ts - DOM inspection, accessible role & name calculation, label resolution
 */

export function cssEscape(val: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(val);
  }
  return val.replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

export interface AriaInfo {
  role: string | null;
  name: string | null;
}

export function getElementRole(el: Element): string | null {
  const explicitRole = el.getAttribute('role');
  if (explicitRole) {
    const primary = explicitRole.trim().split(/\s+/)[0];
    if (primary) return primary.toLowerCase();
  }

  const tag = el.tagName.toLowerCase();
  if (tag === 'button') return 'button';
  if (tag === 'a' && el.hasAttribute('href')) return 'link';
  if (tag === 'textarea') return 'textbox';
  if (tag === 'select') return (el as HTMLSelectElement).multiple ? 'listbox' : 'combobox';
  if (/^h[1-6]$/.test(tag)) return 'heading';
  if (tag === 'table') return 'table';
  if (tag === 'tr') return 'row';
  if (tag === 'td') return 'cell';
  if (tag === 'th') return 'columnheader';
  if (tag === 'ul' || tag === 'ol') return 'list';
  if (tag === 'li') return 'listitem';
  if (tag === 'img') return 'img';
  if (tag === 'nav') return 'navigation';
  if (tag === 'main') return 'main';
  if (tag === 'dialog') return 'dialog';
  if (tag === 'form') return 'form';

  if (tag === 'input') {
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    if (['button', 'submit', 'reset', 'image'].includes(type)) return 'button';
    if (type === 'checkbox') return 'checkbox';
    if (type === 'radio') return 'radio';
    if (['text', 'email', 'tel', 'password', 'url', 'number', 'search'].includes(type)) return 'textbox';
  }

  return null;
}

export function getAccessibleName(el: Element, root: Document | ShadowRoot | Element = el.ownerDocument): string | null {
  // 1. aria-labelledby
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const ids = labelledBy.trim().split(/\s+/);
    const doc = el.ownerDocument || document;
    const labels = ids
      .map(id => doc.getElementById(id)?.textContent?.trim())
      .filter((t): t is string => Boolean(t));
    if (labels.length > 0) return labels.join(' ');
  }

  // 2. aria-label
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim()) {
    return ariaLabel.trim();
  }

  // 3. Label associated with control (for form elements)
  const tag = el.tagName.toLowerCase();
  if (['input', 'textarea', 'select'].includes(tag)) {
    const labelText = getAssociatedLabelText(el);
    if (labelText) return labelText;
  }

  // 4. Alt text (images)
  if (tag === 'img' || (tag === 'input' && el.getAttribute('type') === 'image')) {
    const alt = el.getAttribute('alt');
    if (alt !== null && alt !== undefined) return alt.trim();
  }

  // 5. Value (for input buttons)
  if (tag === 'input' && ['button', 'submit', 'reset'].includes(el.getAttribute('type') || '')) {
    const val = (el as HTMLInputElement).value;
    if (val && val.trim()) return val.trim();
  }

  // 6. Text content for button, link, heading, etc.
  if (['button', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'summary'].includes(tag)) {
    const text = getDirectOrCleanText(el);
    if (text) return text;
  }

  // 7. Title attribute fallback
  const title = el.getAttribute('title');
  if (title && title.trim()) return title.trim();

  // 8. Placeholder fallback for inputs
  const placeholder = el.getAttribute('placeholder');
  if (placeholder && placeholder.trim()) return placeholder.trim();

  return null;
}

export function getAssociatedLabelText(el: Element): string | null {
  const id = el.getAttribute('id');
  const doc = el.ownerDocument || document;
  if (id) {
    const label = doc.querySelector(`label[for="${cssEscape(id)}"]`);
    if (label && label.textContent?.trim()) {
      return label.textContent.trim();
    }
  }

  const parentLabel = el.closest('label');
  if (parentLabel) {
    // Clone and remove the control itself so its text doesn't duplicate
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    const clonedControl = id ? clone.querySelector(`#${cssEscape(id)}`) : clone.querySelector(el.tagName.toLowerCase());
    if (clonedControl) clonedControl.remove();
    const text = clone.textContent?.trim();
    if (text) return text;
  }

  return null;
}

export function getDirectOrCleanText(el: Element): string {
  const text = el.textContent || '';
  return text.replace(/\s+/g, ' ').trim();
}

export function findRootScope(el: Element): Document | ShadowRoot {
  const root = el.getRootNode();
  if (root instanceof ShadowRoot) return root;
  return el.ownerDocument || document;
}
