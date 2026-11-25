import {
  ChainedStep,
  GeneratorConfig,
  LocatorCall,
  LocatorCandidate,
  LocatorKind,
  RefinementStrategy,
} from './types';
import { resolveConfig } from './config';
import {
  findRootScope,
  getAccessibleName,
  getAssociatedLabelText,
  getDirectOrCleanText,
  getElementRole,
  cssEscape,
} from './domUtils';
import { evaluateLocatorSteps } from './evaluator';
import { formatCandidateCode } from './codeGen';

/**
 * Generates an XPath expression for an element
 */
function generateXPath(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.getAttribute('id');
  if (id && !id.includes(':') && !id.includes('.')) {
    return `//*[@id='${id}']`;
  }

  // Check test id
  const testId = el.getAttribute('data-testid');
  if (testId) {
    return `//${tag}[@data-testid='${testId}']`;
  }

  // Relative path with tag and attribute if possible
  const name = el.getAttribute('name');
  if (name) {
    return `//${tag}[@name='${name}']`;
  }

  const role = el.getAttribute('role');
  if (role) {
    return `//${tag}[@role='${role}']`;
  }

  // Fallback to path from parent
  const parent = el.parentElement;
  if (!parent || parent.tagName.toLowerCase() === 'body' || parent.tagName.toLowerCase() === 'html') {
    return `//${tag}`;
  }

  const siblings = Array.from(parent.children).filter(c => c.tagName.toLowerCase() === tag);
  const index = siblings.indexOf(el) + 1;
  const indexSuffix = siblings.length > 1 ? `[${index}]` : '';

  if (parent.id) {
    return `//*[@id='${parent.id}']//${tag}${indexSuffix}`;
  }

  return `//${parent.tagName.toLowerCase()}//${tag}${indexSuffix}`;
}

/**
 * Generates a CSS selector for an element
 */
function generateCssSelector(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.getAttribute('id');
  if (id && !id.includes(':') && !id.includes('.')) {
    return `#${cssEscape(id)}`;
  }

  const name = el.getAttribute('name');
  if (name) {
    return `${tag}[name="${cssEscape(name)}"]`;
  }

  const type = el.getAttribute('type');
  if (type) {
    return `${tag}[type="${cssEscape(type)}"]`;
  }

  // If element has meaningful classes (filtering Angular/React hash-like tokens)
  const classes = Array.from(el.classList).filter(c => !c.startsWith('_ng') && !c.startsWith('ng-'));
  if (classes.length > 0) {
    return `${tag}.${classes.map(c => cssEscape(c)).join('.')}`;
  }

  return tag;
}

/**
 * Finds a good scoping ancestor for an element
 */
function findScopingAncestor(
  el: Element,
  root: Document | ShadowRoot,
  config: GeneratorConfig
): { step: ChainedStep; element: Element } | null {
  let curr = el.parentElement;
  let depth = 0;

  while (curr && depth < config.maxScopingDepth && curr !== (root as any)) {
    depth++;

    // Check testId
    const testId = curr.getAttribute(config.testIdAttribute);
    if (testId) {
      const step: ChainedStep = {
        type: 'locator',
        call: { method: 'getByTestId', args: [testId] },
      };
      const matches = evaluateLocatorSteps(root, [step], config);
      if (matches.length === 1) {
        return { step, element: curr };
      }
    }

    // Check ID
    const id = curr.getAttribute('id');
    if (id && !id.includes(':')) {
      const step: ChainedStep = {
        type: 'locator',
        call: { method: 'locator', args: [`#${cssEscape(id)}`] },
      };
      const matches = evaluateLocatorSteps(root, [step], config);
      if (matches.length === 1) {
        return { step, element: curr };
      }
    }

    // Check Role with Name
    const role = getElementRole(curr);
    const name = getAccessibleName(curr, root);
    if (role && name) {
      const step: ChainedStep = {
        type: 'locator',
        call: { method: 'getByRole', args: [role, { name, exact: true }] },
      };
      const matches = evaluateLocatorSteps(root, [step], config);
      if (matches.length === 1) {
        return { step, element: curr };
      }
    }

    curr = curr.parentElement;
  }

  return null;
}

/**
 * Applies uniqueness guard:
 * If candidate matches > 1 element, refines using:
 * 1. Parent scoping
 * 2. .filter({ hasText: ... })
 * 3. .nth(index)
 */
function refineCandidate(
  initialStep: ChainedStep,
  targetEl: Element,
  root: Document | ShadowRoot,
  config: GeneratorConfig,
  kind: LocatorKind
): LocatorCandidate {
  let steps: ChainedStep[] = [initialStep];
  let matches = evaluateLocatorSteps(root, steps, config);
  let strategy: RefinementStrategy = 'direct';

  if (matches.length === 1 && matches[0] === targetEl) {
    return {
      kind,
      strategy: 'direct',
      isUnique: true,
      matchCount: 1,
      steps,
      code: formatCandidateCode(steps),
      description: 'Matches exactly 1 element',
    };
  }

  // 1. Try parent scoping
  const ancestor = findScopingAncestor(targetEl, root, config);
  if (ancestor) {
    const scopedSteps: ChainedStep[] = [ancestor.step, initialStep];
    const scopedMatches = evaluateLocatorSteps(root, scopedSteps, config);
    if (scopedMatches.length === 1 && scopedMatches[0] === targetEl) {
      return {
        kind,
        strategy: 'scoped',
        isUnique: true,
        matchCount: 1,
        steps: scopedSteps,
        code: formatCandidateCode(scopedSteps),
        description: 'Scoped under unique parent element',
      };
    }
    // If scoping helped reduce candidates and target is still in list, keep scoping
    if (scopedMatches.includes(targetEl) && scopedMatches.length < matches.length) {
      steps = scopedSteps;
      matches = scopedMatches;
      strategy = 'scoped';
    }
  }

  // 2. Try .filter({ hasText: ... })
  const targetText = getDirectOrCleanText(targetEl);
  if (targetText && matches.length > 1) {
    // Check if filtering by targetText isolates it
    const filterStep: ChainedStep = {
      type: 'filter',
      call: { method: 'filter', options: { hasText: targetText } },
    };
    const testSteps = [...steps, filterStep];
    const filteredMatches = evaluateLocatorSteps(root, testSteps, config);

    if (filteredMatches.length === 1 && filteredMatches[0] === targetEl) {
      return {
        kind,
        strategy: 'filtered',
        isUnique: true,
        matchCount: 1,
        steps: testSteps,
        code: formatCandidateCode(testSteps),
        description: 'Refined with .filter({ hasText })',
      };
    }
  }

  // 3. Fallback to .nth(index)
  const idx = matches.indexOf(targetEl);
  if (idx !== -1) {
    const nthStep: ChainedStep = {
      type: 'nth',
      call: { method: 'nth', index: idx },
    };
    const finalSteps = [...steps, nthStep];
    return {
      kind,
      strategy: 'nth',
      isUnique: true,
      matchCount: 1,
      steps: finalSteps,
      code: formatCandidateCode(finalSteps),
      description: `Refined with .nth(${idx}) as last resort`,
    };
  }

  return {
    kind,
    strategy,
    isUnique: matches.length === 1,
    matchCount: matches.length,
    steps,
    code: formatCandidateCode(steps),
    description: `Matches ${matches.length} elements`,
  };
}

/**
 * Core locator generator for an element
 */
export function generateLocators(
  el: Element,
  customConfig?: Partial<GeneratorConfig>
): LocatorCandidate[] {
  const config = resolveConfig(customConfig);
  const root = findRootScope(el);
  const candidates: LocatorCandidate[] = [];

  for (const kind of config.priorityOrder) {
    let step: ChainedStep | null = null;

    switch (kind) {
      case 'getByTestId': {
        const testIdVal = el.getAttribute(config.testIdAttribute);
        if (testIdVal) {
          step = {
            type: 'locator',
            call: { method: 'getByTestId', args: [testIdVal] },
          };
        }
        break;
      }

      case 'getByRole': {
        const role = getElementRole(el);
        if (role) {
          const name = getAccessibleName(el, root);
          const args: any[] = [role];
          if (name) {
            args.push({ name, exact: true });
          }
          step = {
            type: 'locator',
            call: { method: 'getByRole', args },
          };
        }
        break;
      }

      case 'getByLabel': {
        const labelText = getAssociatedLabelText(el);
        if (labelText) {
          step = {
            type: 'locator',
            call: { method: 'getByLabel', args: [labelText, { exact: true }] },
          };
        }
        break;
      }

      case 'getByPlaceholder': {
        const ph = el.getAttribute('placeholder');
        if (ph && ph.trim()) {
          step = {
            type: 'locator',
            call: { method: 'getByPlaceholder', args: [ph.trim()] },
          };
        }
        break;
      }

      case 'getByText': {
        const text = getDirectOrCleanText(el);
        // Avoid pure empty text or massive multiline blocks
        if (text && text.length > 0 && text.length < 120) {
          step = {
            type: 'locator',
            call: { method: 'getByText', args: [text, { exact: true }] },
          };
        }
        break;
      }

      case 'getByAltText': {
        const alt = el.getAttribute('alt');
        if (alt && alt.trim()) {
          step = {
            type: 'locator',
            call: { method: 'getByAltText', args: [alt.trim()] },
          };
        }
        break;
      }

      case 'getByTitle': {
        const title = el.getAttribute('title');
        if (title && title.trim()) {
          step = {
            type: 'locator',
            call: { method: 'getByTitle', args: [title.trim()] },
          };
        }
        break;
      }

      case 'css': {
        const cssSel = generateCssSelector(el);
        if (cssSel) {
          step = {
            type: 'locator',
            call: { method: 'locator', args: [cssSel] },
          };
        }
        break;
      }

      case 'xpath': {
        const xpathSel = generateXPath(el);
        if (xpathSel) {
          step = {
            type: 'locator',
            call: { method: 'locator', args: [xpathSel] },
          };
        }
        break;
      }
    }

    if (step) {
      const candidate = refineCandidate(step, el, root, config, kind);
      candidates.push(candidate);
    }
  }

  return candidates;
}
