import { ChainedStep, LocatorCall, LocatorKind } from './types';
import { getAccessibleName, getElementRole, findRootScope, cssEscape } from './domUtils';

/**
 * Evaluates a sequence of steps against a given root DOM scope,
 * returning the list of matching elements.
 * This ensures locator-core can independently verify uniqueness in the browser or Vitest DOM.
 */
export function queryLocatorStep(
  root: Document | ShadowRoot | Element,
  call: LocatorCall,
  config?: { testIdAttribute?: string }
): Element[] {
  const method = call.method;
  const args = call.args;
  const testIdAttr = config?.testIdAttribute || 'data-testid';

  switch (method) {
    case 'getByTestId': {
      const val = args[0];
      const sel = `[${testIdAttr}="${cssEscape(val)}"]`;
      return Array.from(root.querySelectorAll(sel));
    }

    case 'getByRole': {
      const targetRole = args[0]?.toLowerCase();
      const options = args[1] || {};
      const allElements = Array.from(root.querySelectorAll('*'));
      return allElements.filter(el => {
        const role = getElementRole(el);
        if (!role || role !== targetRole) return false;
        if (options.name !== undefined) {
          const accName = getAccessibleName(el, root);
          if (options.exact) {
            return accName === options.name;
          }
          return accName?.toLowerCase().includes(String(options.name).toLowerCase());
        }
        return true;
      });
    }

    case 'getByLabel': {
      const labelText = String(args[0]).toLowerCase();
      const exact = Boolean(args[1]?.exact);
      const labels = Array.from(root.querySelectorAll('label')).filter(l => {
        const text = l.textContent?.trim().toLowerCase() || '';
        return exact ? text === labelText : text.includes(labelText);
      });

      const targets: Element[] = [];
      const doc = root instanceof Document ? root : root.ownerDocument || document;

      for (const lbl of labels) {
        const forId = lbl.getAttribute('for');
        if (forId) {
          const target = doc.getElementById(forId);
          if (target && !targets.includes(target)) targets.push(target);
        } else {
          const nestedInput = lbl.querySelector('input, textarea, select');
          if (nestedInput && !targets.includes(nestedInput)) targets.push(nestedInput);
        }
      }

      // Also match aria-label directly if it matches
      const ariaLabelMatches = Array.from(root.querySelectorAll('*')).filter(el => {
        const al = el.getAttribute('aria-label')?.trim().toLowerCase();
        if (!al) return false;
        return exact ? al === labelText : al.includes(labelText);
      });

      for (const m of ariaLabelMatches) {
        if (!targets.includes(m)) targets.push(m);
      }

      return targets;
    }

    case 'getByPlaceholder': {
      const ph = args[0];
      const exact = Boolean(args[1]?.exact);
      const candidates = Array.from(root.querySelectorAll('[placeholder]'));
      return candidates.filter(el => {
        const val = el.getAttribute('placeholder') || '';
        return exact ? val === ph : val.toLowerCase().includes(String(ph).toLowerCase());
      });
    }

    case 'getByText': {
      const text = String(args[0]);
      const exact = Boolean(args[1]?.exact);
      const allElements = Array.from(root.querySelectorAll('*'));
      return allElements.filter(el => {
        // Exclude elements like script, style
        const tag = el.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'template'].includes(tag)) return false;
        const clean = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (exact) {
          // If direct text or single child text matches
          return clean === text;
        }
        return clean.toLowerCase().includes(text.toLowerCase());
      });
    }

    case 'getByAltText': {
      const alt = String(args[0]);
      const exact = Boolean(args[1]?.exact);
      const elements = Array.from(root.querySelectorAll('img[alt], input[alt], area[alt]'));
      return elements.filter(el => {
        const val = el.getAttribute('alt') || '';
        return exact ? val === alt : val.toLowerCase().includes(alt.toLowerCase());
      });
    }

    case 'getByTitle': {
      const title = String(args[0]);
      const exact = Boolean(args[1]?.exact);
      const elements = Array.from(root.querySelectorAll('[title]'));
      return elements.filter(el => {
        const val = el.getAttribute('title') || '';
        return exact ? val === title : val.toLowerCase().includes(title.toLowerCase());
      });
    }

    case 'locator':
    default: {
      const sel = args[0];
      if (typeof sel !== 'string') return [];
      if (sel.startsWith('//') || sel.startsWith('xpath=')) {
        const xpathExpr = sel.replace(/^xpath=/, '');
        try {
          const doc = root instanceof Document ? root : root.ownerDocument || document;
          const contextNode = root instanceof Document ? root : root;
          const result = doc.evaluate(
            xpathExpr,
            contextNode,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
          );
          const list: Element[] = [];
          for (let i = 0; i < result.snapshotLength; i++) {
            const node = result.snapshotItem(i);
            if (node instanceof Element) list.push(node);
          }
          return list;
        } catch {
          return [];
        }
      }

      try {
        return Array.from(root.querySelectorAll(sel));
      } catch {
        return [];
      }
    }
  }
}

export function evaluateLocatorSteps(
  root: Document | ShadowRoot | Element,
  steps: ChainedStep[],
  config?: { testIdAttribute?: string }
): Element[] {
  let currentElements: Element[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    if (i === 0) {
      if (step.type !== 'locator') return [];
      currentElements = queryLocatorStep(root, step.call as LocatorCall, config);
    } else {
      if (step.type === 'nth') {
        const idx = (step.call as { method: 'nth'; index: number }).index;
        currentElements = idx >= 0 && idx < currentElements.length ? [currentElements[idx]] : [];
      } else if (step.type === 'filter') {
        const filter = (step.call as { method: 'filter'; options: { hasText?: string; hasNotText?: string } }).options;
        currentElements = currentElements.filter(el => {
          const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
          if (filter.hasText && !txt.includes(filter.hasText)) return false;
          if (filter.hasNotText && txt.includes(filter.hasNotText)) return false;
          return true;
        });
      } else if (step.type === 'locator') {
        // Scoped sub-query inside current matched elements
        const nextSet: Element[] = [];
        for (const el of currentElements) {
          const subs = queryLocatorStep(el, step.call as LocatorCall, config);
          for (const s of subs) {
            if (!nextSet.includes(s)) nextSet.push(s);
          }
        }
        currentElements = nextSet;
      }
    }

    if (currentElements.length === 0) break;
  }

  return currentElements;
}
